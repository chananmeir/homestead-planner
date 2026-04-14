# Homestead Planner Commercialization Roadmap

**Version**: 1.0
**Last Updated**: 2026-01-15
**Status**: Planning

---

## Table of Contents

1. [Overview](#overview)
2. [Phase 1: Foundation (Months 1-3)](#phase-1-foundation-months-1-3)
3. [Phase 2: Security & Infrastructure (Months 3-5)](#phase-2-security--infrastructure-months-3-5)
4. [Phase 3: Production Ready (Months 5-7)](#phase-3-production-ready-months-5-7)
5. [Phase 4: Business Launch (Months 7-9)](#phase-4-business-launch-months-7-9)
6. [Phase 5: Growth & Scale (Months 9+)](#phase-5-growth--scale-months-9)
7. [Cost Estimates](#cost-estimates)
8. [Risk Assessment](#risk-assessment)
9. [Success Metrics](#success-metrics)

---

## Overview

This document outlines the path to commercializing Homestead Planner from a local development application to a production-ready SaaS product.

**Current State**:
- SQLite database with multi-user support in development
- React frontend with comprehensive garden planning features
- Flask backend with established API patterns
- Active development with feature branches

**Target State**:
- Secure, scalable multi-tenant SaaS application
- Production infrastructure with 99.9% uptime
- Subscription-based business model
- Professional support and documentation

---

## Phase 1: Foundation (Months 1-3)

### 1.1 Authentication & User Management

**Priority**: CRITICAL

**Tasks**:
- [ ] Implement production-grade authentication system
  - [ ] JWT with refresh tokens
  - [ ] Password reset flow via email
  - [ ] Email verification
  - [ ] OAuth integration (Google, Facebook optional)
- [ ] Complete user_id foreign key implementation across all tables
- [ ] Test user data isolation thoroughly
- [ ] Implement account settings page
  - [ ] Profile management
  - [ ] Password changes
  - [ ] Account deletion (with data retention policy)

**Files to Create/Modify**:
- `backend/auth.py` - Authentication logic
- `backend/middleware/auth_middleware.py` - Token validation
- `frontend/src/contexts/AuthContext.tsx` - Auth state management
- `frontend/src/components/Auth/` - Login, register, reset components

**Testing Requirements**:
- Unit tests for auth flows
- Integration tests for user isolation
- Security testing for token handling

---

### 1.2 Database Migration Plan

**Priority**: CRITICAL

**Tasks**:
- [ ] Set up PostgreSQL development environment
- [ ] Create migration scripts from SQLite to PostgreSQL
- [ ] Update SQLAlchemy models for PostgreSQL
- [ ] Test all queries for PostgreSQL compatibility
- [ ] Create database backup/restore procedures
- [ ] Document rollback procedures

**PostgreSQL vs SQLite Differences**:
- JSON column types
- Array column types
- Full-text search capabilities
- Concurrent write handling
- Connection pooling

**Estimated Effort**: 2-3 weeks

---

### 1.3 Testing Infrastructure

**Priority**: HIGH

**Tasks**:
- [ ] Set up pytest with fixtures for backend
- [ ] Create test database management
- [ ] Implement Jest/React Testing Library for frontend
- [ ] Set up Playwright for E2E tests
- [ ] Achieve 70%+ code coverage minimum
- [ ] Create CI/CD pipeline (GitHub Actions)

**Test Categories**:
- Unit tests: Individual functions and components
- Integration tests: API endpoints, database operations
- E2E tests: Critical user flows (signup, create garden, plant placement)
- Performance tests: Response times, database queries

---

### 1.4 Environment Configuration

**Priority**: HIGH

**Tasks**:
- [ ] Create environment management system
  - [ ] Development environment
  - [ ] Staging environment
  - [ ] Production environment
- [ ] Set up `.env` files with validation
- [ ] Document all environment variables
- [ ] Implement secret rotation procedures
- [ ] Create environment-specific configs

**Required Environment Variables**:
```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Auth
JWT_SECRET_KEY=<secure-random-key>
JWT_REFRESH_SECRET_KEY=<secure-random-key>
TOKEN_EXPIRY=3600

# Email
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@homesteadplanner.com
SMTP_PASSWORD=<secure-password>

# Application
FLASK_ENV=production
FRONTEND_URL=https://app.homesteadplanner.com
BACKEND_URL=https://api.homesteadplanner.com

# Payments (Phase 4)
STRIPE_SECRET_KEY=<stripe-key>
STRIPE_WEBHOOK_SECRET=<webhook-secret>

# External APIs
WEATHER_API_KEY=<key>
MAPBOX_API_KEY=<key>
```

---

## Phase 2: Security & Infrastructure (Months 3-5)

### 2.1 Security Hardening

**Priority**: CRITICAL

**Tasks**:
- [ ] Implement rate limiting on all API endpoints
- [ ] Add CSRF protection
- [ ] Set up Content Security Policy (CSP)
- [ ] Implement SQL injection prevention
- [ ] Add XSS protection
- [ ] Set up security headers
- [ ] Conduct security audit
- [ ] Implement API request validation (Pydantic/Marshmallow)
- [ ] Add audit logging for sensitive operations

**Security Headers**:
```python
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# Strict-Transport-Security: max-age=31536000; includeSubDomains
# Content-Security-Policy: default-src 'self'
# X-XSS-Protection: 1; mode=block
```

**Rate Limiting Strategy**:
- 100 requests/hour for unauthenticated users
- 1000 requests/hour for authenticated users
- 10 requests/minute for login attempts
- Progressive backoff for repeated failures

---

### 2.2 Infrastructure Setup

**Priority**: CRITICAL

**Tasks**:
- [ ] Select cloud provider (AWS/GCP/Azure recommended)
- [ ] Set up managed database (RDS/Cloud SQL)
- [ ] Configure application servers
- [ ] Set up load balancer
- [ ] Configure CDN (CloudFront/Cloudflare)
- [ ] Implement SSL/TLS certificates
- [ ] Set up monitoring and alerting
- [ ] Configure automated backups

**Recommended AWS Architecture**:
```
┌─────────────────────────────────────────┐
│          Route 53 (DNS)                 │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│     CloudFront (CDN) + WAF              │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│   Application Load Balancer (ALB)      │
└─────────┬───────────────┬───────────────┘
          │               │
    ┌─────▼─────┐   ┌────▼──────┐
    │  ECS Task │   │ ECS Task  │
    │  (Backend)│   │ (Backend) │
    └─────┬─────┘   └────┬──────┘
          │              │
    ┌─────▼──────────────▼──────┐
    │   RDS PostgreSQL           │
    │   (Multi-AZ)               │
    └────────────────────────────┘
```

**Cost Estimates**:
- Small deployment: $100-200/month
- Medium deployment (1000 users): $300-500/month
- Large deployment (10000 users): $1000-2000/month

---

### 2.3 Monitoring & Logging

**Priority**: HIGH

**Tasks**:
- [ ] Set up error tracking (Sentry recommended)
- [ ] Implement structured logging
- [ ] Create log aggregation (CloudWatch/ELK/Datadog)
- [ ] Set up uptime monitoring (Pingdom/UptimeRobot)
- [ ] Create performance monitoring (New Relic/AppDynamics)
- [ ] Build admin dashboard for system metrics
- [ ] Set up alerting rules

**Key Metrics to Monitor**:
- API response times (p50, p95, p99)
- Database query performance
- Error rates by endpoint
- User signups and active users
- Server CPU/memory usage
- Database connections
- Failed login attempts
- Payment processing success rate

---

### 2.4 Backup & Disaster Recovery

**Priority**: CRITICAL

**Tasks**:
- [ ] Implement automated database backups (daily)
- [ ] Test restore procedures monthly
- [ ] Set up point-in-time recovery
- [ ] Create disaster recovery runbook
- [ ] Implement database replication
- [ ] Store backups in multiple regions
- [ ] Set up backup monitoring/alerting

**Backup Schedule**:
- Full backup: Daily at 2 AM UTC
- Incremental backups: Every 6 hours
- Retention: 30 days for daily, 7 days for incremental
- Archive: Monthly backups kept for 1 year

---

## Phase 3: Production Ready (Months 5-7)

### 3.1 Performance Optimization

**Priority**: HIGH

**Tasks**:
- [ ] Implement Redis caching layer
- [ ] Optimize database queries (add indexes)
- [ ] Implement database connection pooling
- [ ] Add frontend code splitting
- [ ] Implement lazy loading for components
- [ ] Optimize images and static assets
- [ ] Set up CDN for static files
- [ ] Implement API response compression
- [ ] Add pagination to all list endpoints

**Caching Strategy**:
- User sessions: Redis (TTL 24 hours)
- Plant database: Redis (TTL 1 hour)
- Garden layouts: Redis (TTL 10 minutes)
- Weather data: Redis (TTL 30 minutes)

**Database Indexes**:
```sql
-- Critical indexes to add
CREATE INDEX idx_planted_item_user_id ON planted_item(user_id);
CREATE INDEX idx_planted_item_bed_id ON planted_item(garden_bed_id);
CREATE INDEX idx_planting_event_user_date ON planting_event(user_id, planting_date);
CREATE INDEX idx_garden_bed_user_id ON garden_bed(user_id);
```

---

### 3.2 Professional UI/UX

**Priority**: MEDIUM-HIGH

**Tasks**:
- [ ] Conduct UX audit
- [ ] Improve mobile responsiveness
- [ ] Add loading states everywhere
- [ ] Implement error boundaries
- [ ] Create onboarding flow for new users
- [ ] Add tooltips and contextual help
- [ ] Implement keyboard shortcuts
- [ ] Create empty states for all lists
- [ ] Add confirmation dialogs for destructive actions
- [ ] Implement toast notifications consistently

**Onboarding Flow**:
1. Welcome screen with product overview
2. Create first property (with sample data option)
3. Add first garden bed (guided)
4. Place first plant (interactive tutorial)
5. View planting calendar (feature highlights)

---

### 3.3 Accessibility (WCAG 2.1 AA)

**Priority**: MEDIUM

**Tasks**:
- [ ] Audit with screen reader (NVDA/JAWS)
- [ ] Ensure keyboard navigation works
- [ ] Add proper ARIA labels
- [ ] Ensure color contrast ratios (4.5:1 minimum)
- [ ] Add skip navigation links
- [ ] Implement focus management
- [ ] Test with accessibility tools (axe, Lighthouse)

---

### 3.4 Documentation

**Priority**: HIGH

**Tasks**:
- [ ] Create user documentation site
- [ ] Write API documentation (OpenAPI/Swagger)
- [ ] Create video tutorials
- [ ] Write troubleshooting guides
- [ ] Document all features with screenshots
- [ ] Create FAQ section
- [ ] Write migration guides (for beta users)

**Documentation Structure**:
```
docs/
├── getting-started/
│   ├── signup.md
│   ├── first-garden.md
│   └── planting-basics.md
├── features/
│   ├── garden-designer.md
│   ├── planting-calendar.md
│   ├── harvest-tracker.md
│   └── livestock.md
├── api/
│   └── openapi.yaml
├── troubleshooting/
│   └── common-issues.md
└── videos/
    └── getting-started.mp4
```

---

## Phase 4: Business Launch (Months 7-9)

### 4.1 Payment Integration

**Priority**: CRITICAL for Revenue

**Tasks**:
- [ ] Set up Stripe account
- [ ] Implement subscription plans
- [ ] Create checkout flow
- [ ] Implement webhook handling
- [ ] Add billing portal (Stripe Customer Portal)
- [ ] Create invoice generation
- [ ] Implement trial period (14 days recommended)
- [ ] Add coupon/promo code support
- [ ] Handle failed payments
- [ ] Implement subscription upgrades/downgrades

**Pricing Strategy (Example)**:
```
Free Tier:
- 1 property
- 3 garden beds
- 50 plants
- Basic features
- Community support

Gardener - $9/month:
- 3 properties
- Unlimited garden beds
- Unlimited plants
- All features
- Email support
- Export data

Homesteader - $19/month:
- Unlimited properties
- Priority support
- Advanced analytics
- API access
- Early feature access
```

**Stripe Integration**:
```python
# backend/billing.py
import stripe

stripe.api_key = os.getenv('STRIPE_SECRET_KEY')

def create_checkout_session(user_id, price_id):
    session = stripe.checkout.Session.create(
        customer_email=user.email,
        payment_method_types=['card'],
        line_items=[{'price': price_id, 'quantity': 1}],
        mode='subscription',
        success_url=f'{FRONTEND_URL}/billing/success',
        cancel_url=f'{FRONTEND_URL}/billing/cancel',
        metadata={'user_id': user_id}
    )
    return session
```

---

### 4.2 Legal & Compliance

**Priority**: CRITICAL

**Tasks**:
- [ ] Form business entity (LLC/Corp)
- [ ] Obtain EIN (Employer Identification Number)
- [ ] Draft Terms of Service
- [ ] Draft Privacy Policy
- [ ] Draft Data Processing Agreement (DPA)
- [ ] Ensure GDPR compliance (if EU users)
- [ ] Ensure CCPA compliance (if CA users)
- [ ] Implement cookie consent
- [ ] Create data export functionality
- [ ] Create data deletion functionality
- [ ] Obtain business insurance
- [ ] Trademark registration (optional)

**GDPR Requirements**:
- Right to access data
- Right to rectification
- Right to erasure ("right to be forgotten")
- Right to data portability
- Right to object to processing
- Data breach notification (72 hours)

**Implementation**:
- Add "Export My Data" button in account settings
- Add "Delete My Account" with confirmation
- Implement audit log for data access
- Create data retention policy (7 years for financial, 30 days for deleted accounts)

---

### 4.3 Customer Support System

**Priority**: HIGH

**Tasks**:
- [ ] Set up support email (support@homesteadplanner.com)
- [ ] Implement helpdesk software (Zendesk/Intercom/Help Scout)
- [ ] Create support ticket system
- [ ] Add live chat widget (optional)
- [ ] Create canned responses for common issues
- [ ] Set up support metrics tracking
- [ ] Create escalation procedures

**Support Tiers**:
- Free: Community forum + email (48-hour response)
- Paid: Priority email (24-hour response)
- Premium: Priority email + live chat (4-hour response)

---

### 4.4 Marketing & Launch

**Priority**: HIGH

**Tasks**:
- [ ] Create marketing website (separate from app)
- [ ] Set up Google Analytics
- [ ] Implement SEO best practices
- [ ] Create social media presence (Twitter, Instagram, Facebook)
- [ ] Write blog content
- [ ] Create email marketing campaigns (Mailchimp/SendGrid)
- [ ] Set up transactional emails
- [ ] Create press kit
- [ ] Submit to directories (Product Hunt, Indie Hackers)
- [ ] Create demo video
- [ ] Set up affiliate program (optional)

**Email Triggers**:
- Welcome email (on signup)
- Trial expiring (3 days before)
- Payment failed
- Feature announcements
- Harvest reminders
- Planting date notifications

**Landing Page Structure**:
1. Hero section with value proposition
2. Feature overview (with screenshots)
3. Pricing table
4. Testimonials (after beta)
5. FAQ
6. Call to action (Start Free Trial)

---

## Phase 5: Growth & Scale (Months 9+)

### 5.1 Feature Expansion

**Priority**: MEDIUM (Post-Launch)

**Potential Features**:
- [ ] Mobile apps (iOS/Android via React Native)
- [ ] Integration with smart garden devices
- [ ] Weather station integration
- [ ] Seed exchange marketplace
- [ ] Community features (share gardens, tips)
- [ ] AI-powered planting recommendations
- [ ] Crop rotation planning
- [ ] Pest and disease identification
- [ ] Garden journal with photos
- [ ] Yield tracking and analytics
- [ ] Recipe suggestions based on harvest
- [ ] Garden sharing with family/friends

---

### 5.2 Analytics & Business Intelligence

**Priority**: HIGH

**Tasks**:
- [ ] Implement user analytics (Mixpanel/Amplitude)
- [ ] Track feature usage
- [ ] Implement cohort analysis
- [ ] Create revenue dashboards
- [ ] Track churn metrics
- [ ] Implement A/B testing framework
- [ ] Create customer satisfaction surveys (NPS)

**Key Metrics**:
- Monthly Recurring Revenue (MRR)
- Customer Acquisition Cost (CAC)
- Lifetime Value (LTV)
- Churn rate
- Active users (DAU/MAU)
- Feature adoption rates
- Conversion rate (free to paid)

---

### 5.3 Scaling Infrastructure

**Priority**: MEDIUM (as needed)

**Tasks**:
- [ ] Implement horizontal scaling
- [ ] Add database read replicas
- [ ] Implement database sharding (if needed)
- [ ] Optimize for multi-region deployment
- [ ] Add queue system (Celery/RabbitMQ) for background jobs
- [ ] Implement websockets for real-time features
- [ ] Add search engine (Elasticsearch) for advanced search

---

### 5.4 Team Building

**Priority**: LOW-MEDIUM (as revenue grows)

**Potential Hires**:
1. **Full-stack Developer** - Feature development
2. **DevOps Engineer** - Infrastructure management
3. **Customer Support** - Handle user inquiries
4. **Marketing Specialist** - Growth and acquisition
5. **Designer** - UI/UX improvements

---

## Cost Estimates

### Initial Setup (One-time)
- Business formation: $500-2000
- Legal (ToS, Privacy): $1000-5000
- Domain & branding: $200-1000
- Initial infrastructure setup: $500
- **Total**: $2,200-8,500

### Monthly Operating Costs

**Minimal (0-100 users)**:
- Cloud infrastructure: $100
- Database: $50
- CDN & storage: $20
- Email service: $10
- Error tracking: $29
- Domain: $10
- **Total**: ~$220/month

**Small Scale (100-1000 users)**:
- Cloud infrastructure: $300
- Database: $100
- CDN & storage: $50
- Email service: $50
- Monitoring: $99
- Error tracking: $29
- Payment processing (2.9% + $0.30): Variable
- **Total**: ~$630/month + transaction fees

**Medium Scale (1000-10000 users)**:
- Cloud infrastructure: $800
- Database: $300
- CDN & storage: $150
- Email service: $200
- Monitoring: $149
- Support software: $99
- **Total**: ~$1,700/month + transaction fees

### Revenue Projections (Example)

**Conservative Scenario**:
- Month 1-3: 0 paying users (beta)
- Month 4-6: 50 users × $9 = $450/month
- Month 7-9: 200 users × $9 = $1,800/month
- Month 10-12: 500 users × $9 = $4,500/month

**Realistic Scenario**:
- Year 1: 1,000 paying users = $9,000/month ($108k/year)
- Year 2: 3,000 paying users = $27,000/month ($324k/year)
- Year 3: 5,000 paying users = $45,000/month ($540k/year)

---

## Risk Assessment

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Data breach | Medium | CRITICAL | Security audit, encryption, monitoring |
| Database corruption | Low | HIGH | Automated backups, testing |
| Scaling issues | Medium | MEDIUM | Load testing, gradual rollout |
| Payment failures | Low | HIGH | Stripe reliability, webhook handling |
| API downtime | Medium | HIGH | Load balancing, monitoring, redundancy |

### Business Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Low user adoption | Medium | CRITICAL | Beta testing, MVP validation, marketing |
| High churn rate | Medium | HIGH | User feedback, feature improvements |
| Competition | HIGH | MEDIUM | Unique features, community building |
| Legal issues | Low | HIGH | Proper legal review, compliance |
| Insufficient revenue | Medium | CRITICAL | Multiple pricing tiers, upsells |

---

## Success Metrics

### Phase 1 (Foundation)
- [ ] 100% user data isolation verified
- [ ] Authentication system deployed
- [ ] 70%+ test coverage achieved
- [ ] CI/CD pipeline functional

### Phase 2 (Security & Infrastructure)
- [ ] Security audit passed with no critical issues
- [ ] Infrastructure deployed to production
- [ ] 99.9% uptime achieved
- [ ] Database backups tested and verified

### Phase 3 (Production Ready)
- [ ] Average API response time < 200ms
- [ ] Lighthouse score > 90
- [ ] WCAG AA compliance verified
- [ ] Documentation complete

### Phase 4 (Business Launch)
- [ ] Payment system live with test transactions
- [ ] 50+ beta users onboarded
- [ ] Legal documents finalized
- [ ] Marketing website live

### Phase 5 (Growth)
- [ ] 1,000 registered users
- [ ] 100 paying customers
- [ ] $1,000 MRR
- [ ] <5% monthly churn rate
- [ ] NPS score > 40

---

## Next Steps

1. **Immediate** (This week):
   - [ ] Review this roadmap and adjust priorities
   - [ ] Set up project management system (Jira/Linear/Trello)
   - [ ] Create detailed timeline with milestones
   - [ ] Identify which phases can be done in parallel

2. **Short-term** (This month):
   - [ ] Start Phase 1 authentication work
   - [ ] Set up PostgreSQL development environment
   - [ ] Begin writing tests
   - [ ] Research cloud providers and pricing

3. **Medium-term** (Next 3 months):
   - [ ] Complete Phase 1 and 2
   - [ ] Beta test with friends/family
   - [ ] Form business entity
   - [ ] Create marketing materials

4. **Long-term** (6+ months):
   - [ ] Public launch
   - [ ] Iterate based on user feedback
   - [ ] Scale infrastructure as needed

---

## Resources

### Recommended Tools & Services
- **Hosting**: AWS, Google Cloud, DigitalOcean
- **Database**: PostgreSQL on RDS/Cloud SQL
- **CDN**: CloudFront, Cloudflare
- **Monitoring**: Sentry, Datadog, New Relic
- **Payments**: Stripe
- **Email**: SendGrid, Amazon SES
- **Support**: Intercom, Help Scout
- **Analytics**: Mixpanel, Amplitude

### Learning Resources
- [Stripe Atlas Guides](https://stripe.com/atlas/guides) - Starting a business
- [AWS Startup Guide](https://aws.amazon.com/startups/)
- [Indie Hackers](https://www.indiehackers.com/) - Community
- [SaaS Pricing](https://www.priceintelligently.com/) - Pricing strategy

---

**Document Owner**: Development Team
**Review Frequency**: Monthly
**Last Major Revision**: Initial creation

---

## Appendix A: Compliance Checklist

### GDPR Compliance
- [ ] Data processing agreement
- [ ] Cookie consent banner
- [ ] Privacy policy with GDPR provisions
- [ ] Data export functionality
- [ ] Data deletion functionality
- [ ] Breach notification procedure
- [ ] Data protection impact assessment

### CCPA Compliance
- [ ] Privacy policy with CCPA provisions
- [ ] "Do Not Sell My Personal Information" link
- [ ] Data disclosure upon request
- [ ] Opt-out mechanism

### PCI DSS Compliance
- [ ] Never store credit card numbers (use Stripe)
- [ ] Secure transmission (HTTPS)
- [ ] Regular security audits

---

## Appendix B: Database Schema Considerations

When migrating to PostgreSQL, consider these schema improvements:

```sql
-- Add full-text search
ALTER TABLE plant_database ADD COLUMN search_vector tsvector;
CREATE INDEX plant_search_idx ON plant_database USING GIN(search_vector);

-- Add spatial indexes for garden layout
CREATE EXTENSION postgis;
ALTER TABLE placed_structure ADD COLUMN geom geometry(POLYGON, 4326);
CREATE INDEX placed_structure_geom_idx ON placed_structure USING GIST(geom);

-- Partitioning for large tables
CREATE TABLE planting_event_2025 PARTITION OF planting_event
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
```

---

## Appendix C: API Rate Limiting Example

```python
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    app,
    key_func=get_remote_address,
    default_limits=["1000 per hour"],
    storage_uri="redis://localhost:6379"
)

@app.route('/api/plants')
@limiter.limit("100 per minute")
def get_plants():
    # Rate limited endpoint
    pass
```

---

## Appendix D: Monitoring Alert Rules

```yaml
alerts:
  - name: High Error Rate
    condition: error_rate > 5%
    window: 5 minutes
    notify: email, slack

  - name: Slow API Response
    condition: p95_response_time > 1000ms
    window: 10 minutes
    notify: slack

  - name: Database Connection Pool Exhausted
    condition: db_connections > 95%
    window: 5 minutes
    notify: email, slack, pagerduty

  - name: Failed Payments
    condition: payment_failure_rate > 10%
    window: 1 hour
    notify: email, slack
```
