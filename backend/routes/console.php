<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
| Release stock held by orders that were never paid for.
|
| Hourly rather than daily: every hour a stale hold survives is an hour a
| one-of-a-kind machine is invisible to every other buyer. `withoutOverlapping`
| because the command takes row locks, and a pile-up would serialise behind them.
*/
Schedule::command('orders:expire-unpaid')
    ->hourly()
    ->withoutOverlapping();
