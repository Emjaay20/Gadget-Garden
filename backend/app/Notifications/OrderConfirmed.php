<?php

namespace App\Notifications;

use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * The receipt, sent once payment clears.
 *
 * QUEUED, and dispatched only after the settling transaction commits (see
 * SettlesPayments). A worker must never be able to pick this up before the
 * order is actually paid, or send a receipt for a transaction that rolled back.
 */
class OrderConfirmed extends Notification implements ShouldQueue
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
        $message = (new MailMessage)
            ->subject("Payment received — order {$this->order->reference}")
            ->greeting("Thank you, {$this->order->contact_name}.")
            ->line('We have received your payment and your order is being prepared.')
            ->line("**Order {$this->order->reference}**");

        foreach ($this->order->items as $item) {
            $line = $item->quantity > 1
                ? "{$item->name_at_time} × {$item->quantity}"
                : $item->name_at_time;

            // The SKU is what identifies the exact machine they bought, and it
            // is what support will ask for.
            if ($item->sku_at_time) {
                $line .= " ({$item->sku_at_time})";
            }

            $message->line("{$line} — ".$this->naira($item->line_total));
        }

        $message
            ->line('**Total paid: '.$this->naira($this->order->total).'**')
            ->line('We will be in touch with delivery details shortly.')
            ->salutation('Gadgets Garden — Computer Village, Ikeja');

        return $message;
    }

    private function naira(int $amount): string
    {
        return '₦'.number_format($amount);
    }
}
