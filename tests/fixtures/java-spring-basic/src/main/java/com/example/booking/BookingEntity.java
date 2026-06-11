package com.example.booking;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;

@Entity
public class BookingEntity {
    @Id
    private String id;
    
    private String status;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
}
