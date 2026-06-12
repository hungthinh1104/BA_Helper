package main

import (
	"net/http"
	"github.com/gin-gonic/gin"
)

func main() {
	// 1. Supported net/http
	http.HandleFunc("/api/v1/booking/refund", processRefundHandler)

	// 2. Supported Gin
	router := gin.Default()
	router.POST("/api/v1/payment/update", updatePaymentHandler)

	// 3. Unsupported patterns
	router.GET("/users/:id", dynamicHandler) // Dynamic
	api := router.Group("/admin") // Route group
}
