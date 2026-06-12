package com.example.booking;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/complex")
public class ComplexUnsupportedController {

    @BookingPostMapping("/custom")
    public void customMapping() {
    }

    @GetMapping(BookingRoutes.API + "/{id}")
    public void dynamicRoute() {
    }

    @GetMapping({"/a", "/b"})
    public void multiRoute() {
    }

    @RequestMapping("/unknown")
    public void unknownMapping() {
    }

    @RequestMapping(value = "/request-method-form", produces = "application/json")
    public void requestMethodForm() {
    }
}
