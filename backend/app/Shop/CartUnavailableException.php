<?php

namespace App\Shop;

use RuntimeException;

/**
 * Thrown when a checkout cannot proceed because something in the cart is no
 * longer buyable.
 *
 * This is an ORDINARY OUTCOME, not an exceptional one — with one-of-a-kind
 * stock, two people wanting the same laptop is a Tuesday. So it carries enough
 * structure for the storefront to mark the specific lines that failed and let
 * the customer continue with the rest, rather than a bare message that forces
 * them to work out what went wrong.
 */
class CartUnavailableException extends RuntimeException
{
    /**
     * @param  array<int, array<string, mixed>>  $lines  The resolved cart, problems included.
     */
    public function __construct(public readonly array $lines)
    {
        parent::__construct('Some items in your cart are no longer available.');
    }

    /**
     * The 422 body. Shaped like a validation error so the storefront's existing
     * error handling reads it without a special case.
     *
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        $problems = collect($this->lines)
            ->filter(fn (array $line) => ! $line['is_available'])
            ->pluck('problem', 'key')
            ->map(fn (?string $problem) => [$problem])
            ->all();

        return [
            'message' => $this->getMessage(),
            'errors' => ['items' => array_values(array_map(fn ($p) => $p[0], $problems))],
            'lines' => $this->lines,
        ];
    }
}
