<?php

use App\Http\Controllers\RefundController;
use App\Http\Controllers\BookingController;
use Illuminate\Support\Facades\Route;

// Supported: array handler with path template
Route::get('/refunds/{id}', [RefundController::class, 'show']);
Route::post('/refunds', [RefundController::class, 'store']);

// Supported: array handler with path template
Route::put('/bookings/{id}', [BookingController::class, 'update']);

// Supported: legacy string handler — extracted with PHP_CONTROLLER_RESOLUTION_BOUNDARY
Route::delete('/bookings/{id}', 'BookingController@destroy');

// Unsupported: middleware boundary — route still extracted, diagnostic emitted
Route::get('/admin/refunds', [RefundController::class, 'adminIndex'])->middleware('auth');

// Unsupported: Route::resource — no artifact, diagnostic emitted
Route::resource('/invoices', \App\Http\Controllers\InvoiceController::class);

// Unsupported: Route::group — no prefix joining, diagnostic emitted
Route::group(['prefix' => 'api'], function () {
    Route::get('/payments', [\App\Http\Controllers\PaymentController::class, 'index']);
});

// Unsupported: dynamic route variable — no artifact, diagnostic emitted
$dynamicPath = '/dynamic/route';
Route::get($dynamicPath, [RefundController::class, 'dynamic']);
