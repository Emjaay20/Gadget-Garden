<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A payment attempt.
 *
 * `raw_response` and `raw_webhook` are hidden by default: they are kept for
 * reconciling a disputed payment, and they contain the payer's bank details. They
 * should be read deliberately from the database, never serialised into a response
 * or a log line.
 */
#[Fillable([
    'order_id', 'provider', 'provider_reference', 'provider_transaction_id',
    'status', 'amount', 'currency', 'account_number', 'account_name', 'bank_name',
    'expires_at', 'authorization_url', 'raw_response', 'raw_webhook', 'paid_at',
])]
#[Hidden(['raw_response', 'raw_webhook'])]
class Payment extends Model
{
    public const STATUSES = ['pending', 'success', 'failed', 'abandoned'];

    /**
     * Mirrors the database defaults — Eloquent does not read them back after an
     * insert, so without this a new Payment has null status and currency in
     * memory. See the same note on Order.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'status' => 'pending',
        'currency' => 'NGN',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'raw_response' => 'array',
            'raw_webhook' => 'array',
            'expires_at' => 'datetime',
            'paid_at' => 'datetime',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /** True when this payment has virtual-account details to show the customer. */
    public function hasAccountDetails(): bool
    {
        return filled($this->account_number);
    }
}
