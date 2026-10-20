<?php

namespace App\Support;

/**
 * The role/permission matrix, in one place.
 *
 * THE source of truth: the seeder, the route middleware and the tests all read
 * from here. A permission string written inline in a controller is a bug — it
 * cannot be audited, and it drifts silently from what the seeder actually grants.
 *
 * Three permissions are deliberately separate because they represent three
 * different kinds of trust:
 *
 *   - `catalogue.manage` — creates products and SETS PRICES. Owner only.
 *   - `inventory.manage` — moves stock and intakes units, without being able to
 *     reprice anything. A manager receives a shipment; they do not decide what
 *     it sells for.
 *   - `orders.manage`    — fulfilment only. Sales staff ship what is paid for.
 *
 * Splitting pricing from stock is the point. In a business reselling
 * one-of-a-kind foreign-used hardware, the ability to quietly drop a ₦1.9m
 * machine to ₦900k is a far larger exposure than the ability to mark it shipped.
 */
final class Permissions
{
    /* --------------------------------------------------------------- roles */

    public const OWNER = 'owner';

    public const MANAGER = 'manager';

    public const SALES = 'sales';

    /* --------------------------------------------------- permission strings */

    public const STAFF_MANAGE = 'staff.manage';

    public const CATALOGUE_MANAGE = 'catalogue.manage';

    public const INVENTORY_VIEW = 'inventory.view';

    public const INVENTORY_MANAGE = 'inventory.manage';

    public const ORDERS_VIEW = 'orders.view';

    public const ORDERS_MANAGE = 'orders.manage';

    public const CUSTOMERS_VIEW = 'customers.view';

    public const CUSTOMERS_MANAGE = 'customers.manage';

    /** Revenue, margin, cost price. Margin exposes what the business paid. */
    public const REPORTS_VIEW = 'reports.view';

    /** Audit logs of staff and critical business actions. */
    public const AUDIT_VIEW = 'audit.view';

    /** Reviewing, countering, and accepting customer offers. */
    public const OFFERS_MANAGE = 'offers.manage';

    /**
     * Every permission the system knows about.
     *
     * @return list<string>
     */
    public static function all(): array
    {
        return [
            self::STAFF_MANAGE,
            self::CATALOGUE_MANAGE,
            self::INVENTORY_VIEW,
            self::INVENTORY_MANAGE,
            self::ORDERS_VIEW,
            self::ORDERS_MANAGE,
            self::CUSTOMERS_VIEW,
            self::CUSTOMERS_MANAGE,
            self::REPORTS_VIEW,
            self::AUDIT_VIEW,
            self::OFFERS_MANAGE,
        ];
    }

    /**
     * @return list<string>
     */
    public static function roles(): array
    {
        return [self::OWNER, self::MANAGER, self::SALES];
    }

    /**
     * What each role may do.
     *
     * `owner` is granted everything by enumeration rather than a wildcard, so a
     * new permission is an explicit decision for every role instead of something
     * the owner silently acquires.
     *
     * @return array<string, list<string>>
     */
    public static function matrix(): array
    {
        return [
            self::OWNER => self::all(),

            // Runs the shop day to day: receives stock, fulfils orders, talks to
            // customers. Cannot reprice the catalogue, cannot create staff, and
            // cannot see margin.
            self::MANAGER => [
                self::INVENTORY_VIEW,
                self::INVENTORY_MANAGE,
                self::ORDERS_VIEW,
                self::ORDERS_MANAGE,
                self::CUSTOMERS_VIEW,
                self::CUSTOMERS_MANAGE,
                self::AUDIT_VIEW,
                self::OFFERS_MANAGE,
            ],

            // The desk. Sees what is in stock so they can answer "do you have
            // it?", and moves orders along. Touches neither stock nor prices.
            self::SALES => [
                self::INVENTORY_VIEW,
                self::ORDERS_VIEW,
                self::ORDERS_MANAGE,
                self::CUSTOMERS_VIEW,
                self::OFFERS_MANAGE,
            ],
        ];
    }

    /**
     * @return list<string>
     */
    public static function for(string $role): array
    {
        return self::matrix()[$role] ?? [];
    }
}
