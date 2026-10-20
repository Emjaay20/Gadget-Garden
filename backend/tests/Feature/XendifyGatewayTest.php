<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Payment;
use App\Payments\Gateways\XendifyGateway;
use App\Payments\PaymentResult;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * The Xendify integration, against faked HTTP.
 *
 * Xendify's published collection documents the REQUEST bodies but not the response
 * JSON for `create_checkout_account` or `transaction_verify`, so the gateway reads
 * defensively across several plausible field names. These tests pin that
 * behaviour down, and are the place to correct it once the sandbox shows the real
 * shapes — a failure here after that is a *good* failure.
 */
class XendifyGatewayTest extends TestCase
{
    use RefreshDatabase;

    private XendifyGateway $gateway;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'shop.xendify.base_url' => 'https://api.xendify.test/api/v1',
            'shop.xendify.secret_key' => 'sk_test_abc123',
            'shop.xendify.provider' => 'safehaven',
            'shop.xendify.webhook_key' => 'whk_test_key',
        ]);

        $this->gateway = new XendifyGateway;
    }

    private function order(): Order
    {
        return Order::factory()->create([
            'reference' => 'GG-7F3K2Q',
            'subtotal' => 620_000,
            'delivery_fee' => 0,
            'total' => 620_000,
            'contact_name' => 'Aisha Bello',
            'contact_email' => 'aisha@example.com',
            'contact_phone' => '08031110001',
        ]);
    }

    /** A pending payment, with or without the trx the webhook would have brought. */
    private function payment(?string $trx): Payment
    {
        return $this->order()->payments()->create([
            'provider' => 'xendify',
            'provider_reference' => 'GG-7F3K2Q',
            'provider_transaction_id' => $trx,
            'status' => 'pending',
            'amount' => 620_000,
            'currency' => 'NGN',
            'account_number' => '1010011220',
        ]);
    }

    public function test_it_requests_a_virtual_account_with_the_documented_body(): void
    {
        // Verbatim from the live sandbox, account number aside.
        Http::fake([
            '*/create_checkout_account' => Http::response([
                'success' => true,
                'status' => '00',
                'message' => 'Account Created Successfully',
                'amount' => '620000',
                'fee' => '50',
                'totalAmount' => '620000',
                'account_name' => 'XENDIFYTECHNOLO Checkout',
                'account_number' => '1010011220',
                'bank_name' => 'Safe Haven MFB',
                'transactionRef' => 'Xendify-w2vtrblkgdukquehwuyhb',
                'reference' => 'GG-7F3K2Q',
                'accountExpiry' => '2026-07-26T21:09:20.674005Z',
            ]),
        ]);

        $instruction = $this->gateway->initialize($this->order());

        $this->assertTrue($instruction->isTransfer());
        $this->assertSame('1010011220', $instruction->accountNumber);
        $this->assertSame('Safe Haven MFB', $instruction->bankName);
        $this->assertSame('XENDIFYTECHNOLO Checkout', $instruction->accountName);
        // Without this the account reads as eternal and a dead one is re-served.
        $this->assertNotNull($instruction->expiresAt);
        $this->assertSame('2026-07-26T21:09:20+00:00', $instruction->expiresAt->toIso8601String());

        Http::assertSent(function ($request) {
            $body = $request->data();

            return str_contains($request->url(), '/create_checkout_account')
                && $request->hasHeader('Authorization', 'Bearer sk_test_abc123')
                // Amount as a string, in naira — matching their example (§4.1).
                && $body['amount'] === '620000'
                && $body['currency'] === 'NGN'
                && $body['reference'] === 'GG-7F3K2Q'
                && $body['provider'] === 'safehaven';
        });
    }

    public function test_it_reads_an_unwrapped_response_too(): void
    {
        // Their docs do not pin down whether the useful fields are nested under
        // `data`, so both shapes are accepted.
        Http::fake([
            '*/create_checkout_account' => Http::response([
                'accountNumber' => '9988776655',
                'bankName' => 'VFD MFB',
            ]),
        ]);

        $instruction = $this->gateway->initialize($this->order());

        $this->assertSame('9988776655', $instruction->accountNumber);
        $this->assertSame('VFD MFB', $instruction->bankName);
    }

    public function test_a_rejected_request_surfaces_xendify_s_own_message(): void
    {
        // Their rejections are a 'success: false' body, so the HTTP status alone
        // cannot be trusted to spot them. The reason must reach the log, otherwise
        // this looks identical to "the provider is down".
        Http::fake([
            '*/create_checkout_account' => Http::response([
                'success' => false,
                'status' => '24',
                'message' => 'Amount cannot be less than 1',
            ]),
        ]);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Amount cannot be less than 1');

        $this->gateway->initialize($this->order());
    }

    public function test_it_refuses_to_proceed_without_an_account_number(): void
    {
        // The customer would have nowhere to send money.
        Http::fake(['*/create_checkout_account' => Http::response(['status' => true, 'data' => []])]);

        $this->expectException(\RuntimeException::class);

        $this->gateway->initialize($this->order());
    }

    public function test_it_refuses_to_proceed_without_an_api_key(): void
    {
        config(['shop.xendify.secret_key' => null]);

        $this->expectException(\RuntimeException::class);

        (new XendifyGateway)->initialize($this->order());
    }

    public function test_status_00_means_success(): void
    {
        Http::fake([
            '*/transaction_verify/*' => Http::response([
                'status' => '00',
                'amount' => '620000',
                'trx' => '202212261450837964477',
                'timestamp' => '2026-07-25T19:45:09.000000Z',
            ]),
        ]);

        $result = $this->gateway->verify($this->payment('202212261450837964477'));

        $this->assertTrue($result->isSuccess());
        // Naira, not kobo — their amounts arrive as strings in major units.
        $this->assertSame(620000, $result->amount);
        $this->assertSame('202212261450837964477', $result->transactionId);

        // The trx, never our order reference — it is the only key the endpoint takes.
        Http::assertSent(fn ($request) => str_contains(
            $request->url(), '/transaction_verify/202212261450837964477'
        ));
    }

    public function test_it_cannot_verify_before_the_webhook_delivers_a_trx(): void
    {
        // `/transaction_verify` answers to a trx and nothing else, and the trx only
        // arrives on the collection webhook. Asking with our own reference would be
        // a guaranteed-useless request, so no request is made at all.
        Http::fake();

        $result = $this->gateway->verify($this->payment(null));

        $this->assertSame(PaymentResult::PENDING, $result->status);
        Http::assertNothingSent();
    }

    public function test_an_unreachable_verify_is_pending_not_failed(): void
    {
        // The money may be perfectly fine and Xendify merely down. Treating that as
        // a failure would cancel paid orders.
        Http::fake(['*/transaction_verify/*' => Http::response('', 500)]);

        $result = $this->gateway->verify($this->payment('202212261450837964477'));

        $this->assertSame(PaymentResult::PENDING, $result->status);
    }

    public function test_a_declined_transaction_is_failed(): void
    {
        Http::fake(['*/transaction_verify/*' => Http::response(['status' => 'failed'])]);

        $this->assertSame(PaymentResult::FAILED, $this->gateway->verify($this->payment('x'))->status);
    }

    public function test_an_unknown_status_is_pending(): void
    {
        // Never guess "success" from a status we do not recognise.
        Http::fake(['*/transaction_verify/*' => Http::response(['status' => 'something-new'])]);

        $this->assertSame(PaymentResult::PENDING, $this->gateway->verify($this->payment('x'))->status);
    }

    public function test_it_parses_the_collection_webhook(): void
    {
        // Every field Xendify sends on a successful collection.
        $request = Request::create('/webhook', 'POST', [
            'status' => '00',
            'event' => 'collection',
            'currency' => 'NGN',
            'amount' => '620000',
            'fee' => '50',
            'stamp_duty' => '0',
            'receiving_account' => '1010011220',
            'sender_account_name' => 'Tolulope Oyeniyi',
            'sender_account_number' => '0123456789',
            'sender_bank_code' => '058',
            'sender_narration' => 'Transfer',
            'sessionId' => '090286260726210920123456789012',
            'trx' => '202212261450837964477',
            // Xendify's own transaction reference — NOT ours.
            'reference' => 'Xendify-w2vtrblkgdukquehwuyhb',
            'channel' => 'bank_transfer',
            'type' => 'credit',
            'domain' => 'live',
            'gateway' => 'safehaven',
            'customer_email' => 'aisha@example.com',
            // Ours, echoed back from create_checkout_account.
            'customer_reference' => 'GG-7F3K2Q',
            'timestamp' => '2026-07-26T20:11:04.000000Z',
        ]);

        $event = $this->gateway->parseWebhook($request);

        $this->assertTrue($event->isIdentifiable());
        $this->assertSame('202212261450837964477', $event->transactionId);
        // The credited virtual account is the most reliable route back to an order.
        $this->assertSame('1010011220', $event->accountNumber);
        $this->assertSame(620000, $event->amount);
        // `customer_reference` must win over `reference`: the latter is Xendify's
        // transaction ref and matches no order of ours.
        $this->assertSame('GG-7F3K2Q', $event->reference);
    }

    public function test_it_accepts_only_the_configured_bearer_key(): void
    {
        config(['shop.xendify.webhook_key' => 'whk_correct']);
        $gateway = new XendifyGateway;

        $this->assertTrue($gateway->authenticateWebhook($this->webhookWithKey('whk_correct')));
        $this->assertFalse($gateway->authenticateWebhook($this->webhookWithKey('whk_wrong')));
        // No header at all — the case a stranger who found the URL would present.
        $this->assertFalse($gateway->authenticateWebhook(Request::create('/webhook', 'POST')));
    }

    public function test_an_unconfigured_key_rejects_everything(): void
    {
        // Fails closed. A missing key must break settlement loudly rather than let
        // anonymous POSTs through — they could wedge an order by poisoning its trx.
        config(['shop.xendify.webhook_key' => null]);

        $this->assertFalse((new XendifyGateway)->authenticateWebhook($this->webhookWithKey('anything')));
    }

    private function webhookWithKey(string $key): Request
    {
        return Request::create('/webhook', 'POST', server: ['HTTP_AUTHORIZATION' => "Bearer {$key}"]);
    }
}
