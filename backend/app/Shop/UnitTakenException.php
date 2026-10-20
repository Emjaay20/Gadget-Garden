<?php

namespace App\Shop;

use RuntimeException;

/**
 * Internal control flow only: a reservation lost the race inside the checkout
 * transaction.
 *
 * Never escapes PlacesOrders — it is caught immediately outside the transaction
 * and converted into a CartUnavailableException carrying freshly-read state.
 * It exists purely so the transaction wrapper performs the rollback rather than
 * the business logic unwinding it by hand.
 */
class UnitTakenException extends RuntimeException {}
