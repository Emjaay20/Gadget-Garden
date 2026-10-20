<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Checkout input.
 *
 * NOTE WHAT IS NOT HERE: no prices, no totals, no delivery fee. The browser
 * sends identifiers, quantities, and where to send the thing. Every figure is
 * computed server-side from the catalogue (see ResolvesCart), so there is
 * nowhere for a tampered amount to land.
 */
class PlaceOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        // The storefront is deliberately unauthenticated — there are no customer
        // accounts. Throttling and CORS are the controls on this route.
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'items' => ['required', 'array', 'min:1', 'max:20'],
            'items.*.product_id' => ['nullable', 'integer'],
            'items.*.product_unit_id' => ['nullable', 'integer'],
            'items.*.quantity' => ['nullable', 'integer', 'min:1', 'max:20'],

            'contact.name' => ['required', 'string', 'max:120'],
            'contact.email' => ['required', 'email', 'max:255'],
            // Deliberately loose: Nigerian numbers are written 0805…, +234805…,
            // and with spaces or dashes. Rejecting a real customer's real number
            // over formatting costs a sale; staff can read any of these.
            'contact.phone' => ['required', 'string', 'max:32'],

            'delivery_zone' => ['required', 'string', 'exists:delivery_zones,slug'],
            'offer_reference' => ['nullable', 'string', 'max:20', 'exists:offers,reference'],
            'address.line1' => ['required', 'string', 'max:255'],
            'address.city' => ['required', 'string', 'max:120'],
            'address.state' => ['required', 'string', 'max:120'],
            'address.landmark' => ['nullable', 'string', 'max:255'],
            'address.note' => ['nullable', 'string', 'max:500'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'items.required' => 'Your cart is empty.',
            'delivery_zone.exists' => 'Choose a delivery area.',
            'contact.email.email' => 'We need a working email to send your receipt to.',
        ];
    }
}
