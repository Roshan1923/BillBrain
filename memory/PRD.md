# BillBrain - Product Requirements Document

## Overview
BillBrain is a full-stack bills and receipts tracking app that helps users scan, store, organize, and manage their receipts/bills throughout the year, primarily for tax filing purposes.

## Tech Stack
- **Frontend**: React Native with Expo (SDK 54), Expo Router (file-based routing)
- **Backend**: FastAPI (Python)
- **Database**: MongoDB (via Motor async driver)
- **OCR**: GPT-4o Vision via Emergent Universal Key
- **Auth**: Email+Password (bcrypt) + Emergent Google OAuth

## Features Implemented

### 1. Authentication & User Management
- Email + Password registration and login (bcrypt hashing)
- Google Sign-In via Emergent OAuth
- Session-based auth with 7-day token expiry
- Each user has private data isolation

### 2. Two Main Sections
- **Personal** (blue theme) — for personal/household receipts
- **Business** (green theme) — for business-related receipts

### 3. Categories (Default + Custom)
- 14 default categories seeded per section (28 total per user)
- Categories: Food & Dining, Transportation, Entertainment, Shopping, Health & Medical, Utilities & Bills, Education, Travel, Home & Rent, Office Supplies, Subscriptions & Memberships, Gifts & Donations, Insurance, Miscellaneous
- Users can add, edit, and delete custom categories
- Warning when deleting categories with assigned receipts

### 4. Receipt Input Methods
- **Camera Scan**: Opens device camera, captures receipt, runs OCR
- **Photo Upload**: Select from gallery, runs OCR
- **Manual Entry**: Full form with all fields
- OCR extracts: merchant name, date, total, tax (GST/HST), items, payment method

### 5. Receipt Storage & Management
- Full CRUD (create, read, update, delete)
- Filter by: section, category, date range, amount range
- Search by merchant name
- Image stored as base64 in MongoDB

### 6. Dashboard & Summary
- Monthly and Year-to-Date spending totals
- Personal vs Business visual breakdown bar
- Top categories bar chart
- Recent receipts list
- Quick action buttons (Scan, Upload, Manual)

### 7. Tax Reports & Export
- Tax summary report by year with section and category breakdowns
- CSV export with all receipt data
- Year selector with custom date range support

### 8. Settings
- User profile display
- Currency: CAD (Canadian Dollar) with GST/HST
- Categories management (add, edit, delete)
- Sign out

## Design
- Dark mode first (OLED-friendly #050505 background)
- Color palette from BillBrain logo: Primary Blue #0274BC, Electric Cyan #1AC9FF
- Personal = Blue theme, Business = Green theme
- Modern fintech aesthetic with card-based layout
- 8pt grid spacing system
- 44px+ touch targets

## API Endpoints
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/google-session` - Google OAuth session exchange
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout
- `GET /api/categories` - List categories
- `POST /api/categories` - Create category
- `PUT /api/categories/{id}` - Update category
- `DELETE /api/categories/{id}` - Delete category
- `GET /api/receipts` - List receipts (with filters)
- `POST /api/receipts` - Create receipt
- `GET /api/receipts/{id}` - Get receipt detail
- `PUT /api/receipts/{id}` - Update receipt
- `DELETE /api/receipts/{id}` - Delete receipt
- `POST /api/ocr/scan` - OCR scan receipt image
- `GET /api/dashboard/summary` - Dashboard data
- `GET /api/reports/tax-summary` - Tax report data
- `GET /api/reports/export-csv` - Export CSV

## Testing Results
- Backend: 14/14 tests passing (100%)
- Frontend: All features tested and working (100%)
