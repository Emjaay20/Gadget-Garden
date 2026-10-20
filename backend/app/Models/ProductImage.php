<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * Photography for a product or a single unit. See the migration for why both.
 */
#[Fillable(['path', 'alt', 'position'])]
class ProductImage extends Model
{
    public function imageable(): MorphTo
    {
        return $this->morphTo();
    }
}
