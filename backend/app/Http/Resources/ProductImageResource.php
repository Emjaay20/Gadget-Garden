<?php

namespace App\Http\Resources;

use App\Models\ProductImage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/** @mixin ProductImage */
class ProductImageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $url = (str_starts_with($this->path, 'http://') || str_starts_with($this->path, 'https://'))
            ? $this->path
            : Storage::disk('public')->url($this->path);

        return [
            'id' => (string) $this->id,
            'url' => $url,
            'path' => $this->path,
            'alt' => $this->alt,
            'position' => (int) $this->position,
        ];
    }
}
