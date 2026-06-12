package com.example.booking;

import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.ArrayList;

@RestController
@RequestMapping("/api/payments")
public class PaymentController {

    @PostMapping
    public Payment processPayment(@RequestBody PaymentRequest request) {
        return new Payment();
    }

    @PutMapping("/{id}")
    public Payment updatePayment(@PathVariable String id, @RequestBody PaymentRequest request) {
        return new Payment();
    }

    @DeleteMapping("/{id}")
    public void deletePayment(@PathVariable String id) {
    }

    @GetMapping("/{id}")
    public Payment getPayment(@PathVariable String id) {
        return new Payment();
    }

    @PatchMapping("/{id}")
    public Payment patchPayment(@PathVariable String id, @RequestBody PaymentRequest request) {
        return new Payment();
    }

    @RequestMapping(method = RequestMethod.GET, value = "/all")
    public List<Payment> getAllPayments() {
        return new ArrayList<>();
    }

    @RequestMapping(value = "/submit", method = RequestMethod.POST)
    public Payment submitPayment() {
        return new Payment();
    }

    @RequestMapping(path = "/cancel/{id}", method = RequestMethod.DELETE)
    public void cancelPayment(@PathVariable String id) {
    }
}

class PaymentRequest {}
class Payment {}
