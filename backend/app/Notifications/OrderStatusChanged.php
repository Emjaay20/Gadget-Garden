<?php

namespace App\Notifications;

use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Fulfilment updates: processing, shipped, delivered, cancelled.
 *
 * `paid` is deliberately NOT here — that is `OrderConfirmed`, and sending both
 * would mean two emails for one event.
 *
 * Only real transitions send. A staff note, or a double-clicked button that
 * resolves to a no-op, sends nothing: an inbox that pings every time somebody
 * opens the order page teaches customers to ignore the emails that matter.
 */
class OrderStatusChanged extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly Order $order) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        [$subject, $body] = $this->copyFor($this->order->status);

        return (new MailMessage)
            ->subject("{$subject} — order {$this->order->reference}")
            ->greeting("Hello {$this->order->contact_name},")
            ->line($body)
            ->line("Your reference is {$this->order->reference}.")
            ->salutation('Gadgets Garden — Computer Village, Ikeja');
    }

    /**
     * Copy per status, kept here rather than in a Blade view so all of it is
     * readable in one place and one view renders every case.
     *
     * @return array{string, string}
     */
    private function copyFor(string $status): array
    {
        return match ($status) {
            Order::PROCESSING => [
                'We are preparing your order',
                'Your machine is being checked and packed. We will let you know the moment it leaves us.',
            ],
            Order::SHIPPED => [
                'Your order is on its way',
                'Your order has left our shop and is with the courier. Delivery is usually 1–3 working days depending on your state.',
            ],
            Order::DELIVERED => [
                'Your order has been delivered',
                'Your order is marked delivered. Every item carries a warranty — if anything is not right, reply to this email or message us on WhatsApp and we will sort it out.',
            ],
            Order::CANCELLED => [
                'Your order has been cancelled',
                'Your order has been cancelled. If you paid, a refund is being arranged — please reply to this email if you have not heard from us within two working days.',
            ],
            default => [
                'An update on your order',
                'There has been an update to your order.',
            ],
        };
    }
}
