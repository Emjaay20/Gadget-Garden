<?php

namespace App\Payments\Gateways;

use App\Models\Order;
use App\Models\Payment;
use App\Payments\PaymentGateway;
use App\Payments\PaymentInstruction;
use App\Payments\PaymentResult;
use App\Payments\WebhookEvent;
use Illuminate\Http\Request;
use RuntimeException;

/** Production-safe default until real collection credentials are configured. */
class DisabledGateway implements PaymentGateway
{
    public function name(): string { return 'disabled'; }

    public function initialize(Order $order, ?int $amount = null, ?string $reference = null): PaymentInstruction
    {
        throw new RuntimeException('Online payments are not configured yet. Please contact the shop before placing an order.');
    }

    public function verify(Payment $payment): PaymentResult { return PaymentResult::pending(); }

    public function authenticateWebhook(Request $request): bool { return false; }

    public function parseWebhook(Request $request): WebhookEvent { return new WebhookEvent(raw: []); }
}
