<?php

namespace App\Notifications;

use App\Models\Customer;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Welcomes a customer upon account creation.
 *
 * Explains Gadgets Garden's value proposition:
 *  - Store location in Computer Village, Ikeja
 *  - Tested hardware with warranty
 *  - First-purchase voucher (WELCOME5K)
 */
class CustomerWelcome extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly Customer $customer) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Welcome to Gadgets Garden — Computer Village, Ikeja')
            ->greeting("Hello {$this->customer->name},")
            ->line('Welcome to Gadgets Garden! Your customer account has been created.')
            ->line('We are Lagos’s premier gadget retailer based in Computer Village, Ikeja. Every laptop we stock is physically tested, graded, and comes with a direct hardware warranty.')
            ->line('**Your First Purchase Gift:**')
            ->line('Use code **WELCOME5K** at checkout to get ₦5,000 off your first laptop order over ₦150,000.')
            ->action('Start Browsing Laptops', config('app.url') ?? 'http://localhost:3000')
            ->line('You can log in to your account anytime to view your past orders, active deliveries, and digital warranty certificates.')
            ->salutation('Gadgets Garden — QUALITY. TRUST. PERFORMANCE.');
    }
}
