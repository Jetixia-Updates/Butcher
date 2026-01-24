# Quick Reference - Security & Performance Improvements

## 1. Zod Validation Schema Usage

### How to use validated endpoints:

```typescript
// Login - with validation
POST /api/users/login
{
  "username": "john_doe",        // min 3 chars
  "password": "SecurePass123"    // min 6 chars
}

// Registration - with strong validation
POST /api/users
{
  "username": "john_doe",        // min 3 chars, unique
  "email": "john@example.com",   // valid email format
  "mobile": "+971501234567",     // valid phone
  "password": "SecurePass123",   // min 8, uppercase, numbers
  "firstName": "John",
  "familyName": "Doe",
  "emirate": "Dubai"
}

// Create Order - with strict validation
POST /api/orders
{
  "userId": "user_123",
  "items": [
    {
      "productId": "prod_1",
      "quantity": 5,
      "unitPrice": 150.00
    }
  ],
  "addressId": "addr_1",
  "paymentMethod": "card",       // enum: card, cod, bank_transfer
  "deliveryFee": 15.00,
  "subtotal": 750.00,
  "vatAmount": 37.50,
  "total": 802.50
}
```

### Validation Error Response:
```json
{
  "success": false,
  "error": "Validation error: password: Password must be at least 8 characters"
}
```

---

## 2. Rate Limiting Behavior

### Login Rate Limit
- **Limit:** 5 attempts per 15 minutes
- **Error Code:** 429 Too Many Requests
- **Response:**
```json
{
  "success": false,
  "error": "Too many login attempts, please try again later"
}
```

### Registration Rate Limit
- **Limit:** 3 registrations per hour per IP
- **Error Code:** 429 Too Many Requests

### Payment Rate Limit
- **Limit:** 10 payment attempts per 10 minutes
- **Error Code:** 429 Too Many Requests

### General Rate Limit (All endpoints)
- **Limit:** 100 requests per minute per IP
- **Error Code:** 429 Too Many Requests

---

## 3. Pagination Examples

### Get Products with Pagination
```
GET /api/products?page=1&limit=20

Response:
{
  "success": true,
  "data": [...20 products...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 500,
    "totalPages": 25
  }
}
```

### Filter + Paginate
```
GET /api/products?category=meat&page=2&limit=50&featured=true

Parameters:
- page: 2 (which page to fetch)
- limit: 50 (items per page, max 100)
- category: meat (filter)
- featured: true (filter)
```

### Calculate Pages
```
Total Items: 500
Page Size: 20
Total Pages: 500 / 20 = 25

To get item 100-150:
Page = ceil(100 / 20) = 5
GET /api/products?page=5&limit=20
```

---

## 4. Cache Duration Reference

| Endpoint | Cache Duration | When to Refresh |
|----------|---|---|
| GET /api/products | 5 minutes | After adding/updating products |
| GET /api/products/:id | 1 hour | After updating product details |
| GET /api/stock | 5 minutes | After inventory updates |
| GET /api/stock/:productId | 10 minutes | After stock adjustments |
| GET /api/orders | 1 minute | After order updates |
| GET /api/analytics/dashboard | 2 minutes | For real-time updates |
| GET /api/settings | 1 hour | After changing settings |

### How to Refresh Cache
```typescript
// Method 1: Manual header bypass
curl -H "Cache-Control: no-cache" http://localhost/api/products

// Method 2: Wait for duration to expire
// (automatic after max-age seconds)

// Method 3: Hard refresh (Ctrl+F5)
// (browser will skip cache)
```

---

## 5. Common Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| 400 | Bad Request / Validation Failed | Check request format |
| 401 | Unauthorized | Login required |
| 404 | Not Found | Resource doesn't exist |
| 429 | Too Many Requests | Rate limit exceeded, wait and retry |
| 500 | Server Error | Database unavailable |

### Rate Limit Response Headers
```
HTTP/1.1 429 Too Many Requests
Retry-After: 300
RateLimit-Limit: 5
RateLimit-Remaining: 0
RateLimit-Reset: 1704067200
```

---

## 6. Implementation Details

### Validation Middleware
```typescript
// Applied to endpoints like:
app.post('/api/users/login', 
  loginLimiter,                    // Rate limit check
  validateRequest(LoginSchema),    // Zod validation
  async (req, res) => {
    // Handler code
  }
);
```

### Caching Middleware
```typescript
// Applied to read endpoints like:
app.get('/api/products', 
  cacheControl(300),  // 5-minute cache
  async (req, res) => {
    // Handler code
  }
);
```

---

## 7. Troubleshooting

### "Too many requests" error
**Problem:** Getting 429 responses  
**Solution:** Wait for rate limit window to reset
- Login limit: Wait 15 minutes
- Registration limit: Wait 1 hour  
- Payment limit: Wait 10 minutes

### Validation errors
**Problem:** Getting validation error responses  
**Solution:** Check your request format
- Ensure all required fields present
- Check field types (numbers vs strings)
- Validate email/phone formats
- Check enum values

### Stale cached data
**Problem:** Getting old data after update  
**Solution:** Clear cache
- Wait for cache duration to expire
- Press Ctrl+F5 in browser
- Use `Cache-Control: no-cache` header

### Pagination not working
**Problem:** Getting all items or wrong page  
**Solution:** Check parameters
- Ensure ?page=1 starts at 1 (not 0)
- Check limit value (default 20, max 100)
- Verify correct filter parameters

---

## 8. Performance Tips

### For Developers
1. Use pagination for large datasets (never skip)
2. Respect rate limits in testing
3. Use correct `Accept-Encoding: gzip` for compression
4. Cache responses on client side when possible

### For System Admins
1. Monitor 429 responses (indicates attack)
2. Adjust rate limits based on usage patterns
3. Implement CDN for cache distribution
4. Use WAF (Web Application Firewall) for additional protection

### For DevOps
1. Rate limiting works behind proxies with `X-Forwarded-For`
2. Cache headers work with CloudFlare, AWS CloudFront
3. No Redis needed (HTTP caching used)
4. Works with load balancers transparently

---

## 9. Testing Checklist

- [ ] Can submit valid login request
- [ ] Get 429 after 5 failed login attempts
- [ ] Get validation error with invalid email in registration
- [ ] Can paginate products with ?page=2&limit=50
- [ ] Cache headers present in response (`Cache-Control: public, max-age=...`)
- [ ] No excessive memory usage with large product lists
- [ ] Rate limit resets after window expires

---

## 10. Security Checklist

- ✅ Passwords validated (min 8 chars, uppercase, numbers)
- ✅ Emails validated (email format)
- ✅ Phones validated (phone format)
- ✅ Rate limiting active (5 login attempts/15 min)
- ✅ Input validation strict (Zod schemas)
- ✅ Prevents brute force (rate limits)
- ✅ Prevents spam (registration limits)
- ✅ Prevents DoS (general rate limit)

---

## Questions?

For full details, see: SECURITY_PERFORMANCE_IMPROVEMENTS.md
