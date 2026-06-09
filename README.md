# HighCRM Backend - JWT Auth & Roles/Permissions Matrix

This repository contains a secure backend service developed in **Node.js**, **Express**, and **PostgreSQL** using **Sequelize ORM**. It features secure JWT authentication (with access & refresh tokens) and a dynamic role-based access control (RBAC) permissions matrix matching the platform's requirements.

All tables in the database automatically record audit metadata via `createdBy` and `updatedBy` foreign keys referencing the admin user who created or last modified each record, alongside system timestamps.

---

## 🛠 Tech Stack

- **Core**: Node.js, Express.js
- **Database**: PostgreSQL
- **ORM**: Sequelize
- **Security**: JWT (`jsonwebtoken`), Password Hashing (`bcryptjs`), Security Headers (`helmet`), CORS (`cors`)
- **Logging**: Morgan

---

## 🚀 Getting Started

### 1. Database Setup
Make sure you have a local PostgreSQL instance running. Create a database for the application:
```sql
CREATE DATABASE highcrm;
```

### 2. Environment Configuration
Create or modify the `.env` file in the root directory. Adjust the values to match your local PostgreSQL server credentials:
```env
PORT=5000
NODE_ENV=development

# Database Settings
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_postgres_password
DB_NAME=highcrm

# JWT Settings
JWT_SECRET=your_jwt_access_secret_key
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key
JWT_EXPIRE=15m
JWT_REFRESH_EXPIRE=7d
```

### 3. Installation
Install the project dependencies:
```bash
npm install
```

### 4. Running the Application
Start the server in development mode (with hot reloading via `nodemon`):
```bash
npm run dev
```
Upon launching, Sequelize will automatically synchronize models with the database schema and execute the seeding process to populate modules, roles, the default permission matrix, and create the bootstrap Super Admin user.

---

## 🧪 Seeding & Default Credentials

When the database syncs for the first time, it automatically creates the following default entities:

* **Modules seeded**: Dashboard, Users, Finance, Trading, Copy Trading, Prop Trading, IB System, Group Management, Reports, Support Desk, Platform Settings, Admin Management.
* **Roles seeded**: Super Admin, Risk Officer, Compliance, Finance, Support Agent, Read Only.
* **Permissions Matrix seeded**: Corresponding permissions matching the matrix configuration.
* **Default Super Admin**:
  * **Email**: `admin@highcrm.com`
  * **Username**: `admin`
  * **Password**: `AdminPassword123!` (automatically hashed)

---

## 🧪 Verification & Testing
To run the end-to-end integration test suite, execute:
```bash
npm run test-api
```
This script resets a temporary test schema, runs the DB seeder, boots a temporary test server on port `5999`, and validates registration, login, RBAC restrictions, custom role creation, user role updates, and audit fields.

---

## 📖 Interactive API Documentation (Swagger UI)

Interactive OpenAPI 3.0 documentation is mounted directly in the application. Once the server is running, you can explore, test, and view detail payloads and schemas by visiting:
* **Swagger UI URL**: `http://localhost:5000/api-docs`

Use the **Authorize** lock button in Swagger UI to test protected endpoints. Type `Bearer <your_access_token>` to authorize your session.

---

## 📄 API Documentation

### 1. Authentication (`/api/auth`)

#### Register User
* **Endpoint**: `POST /api/auth/register`
* **Access**: Public
* **Body**:
  ```json
  {
    "username": "johndoe",
    "email": "johndoe@example.com",
    "password": "securepassword"
  }
  ```
* **Response**: Returns access and refresh JWT tokens and assigns the default `read_only` role.

#### Login
* **Endpoint**: `POST /api/auth/login`
* **Access**: Public
* **Body**:
  ```json
  {
    "usernameOrEmail": "admin",
    "password": "AdminPassword123!"
  }
  ```

#### Refresh Access Token
* **Endpoint**: `POST /api/auth/refresh`
* **Access**: Public (requires refresh token)
* **Body**:
  ```json
  {
    "refreshToken": "eyJhbGciOi..."
  }
  ```

#### Fetch My Profile
* **Endpoint**: `GET /api/auth/me`
* **Access**: Protected (requires JWT in header `Authorization: Bearer <token>`)
* **Response**: Returns profile info, the active role, and a parsed JSON permissions matrix list grouped by module.

---

### 2. Role & Access Management (`/api/roles`)

*All endpoints in this section require active authentication and `admin_management` view/create/edit/delete permissions.*

#### Get Roles List (Admins Count)
* **Endpoint**: `GET /api/roles`
* **Response**: Lists all roles. Includes the number of administrators (`adminsCount`) assigned to each role (matching the "Admins" column in Screenshot 2).

#### Get Single Role with Matrix (Screenshot 1 Matrix layout)
* **Endpoint**: `GET /api/roles/:id`
* **Response**: Returns role details along with a fully expanded permissions matrix mapping all system modules and checking active actions (`view`, `create`, `edit`, `approve`, `delete`, `export`, `assign`).

#### Create Custom Role
* **Endpoint**: `POST /api/roles`
* **Body**:
  ```json
  {
    "name": "Compliance Supervisor",
    "description": "Supervisor over KYC and AML validation teams",
    "scope": "COMPLIANCE_SUPERVISION",
    "status": "ACTIVE",
    "permissions": [
      {
        "moduleKey": "users",
        "actions": ["view", "create", "edit", "approve"]
      },
      {
        "moduleKey": "reports",
        "actions": ["view", "export"]
      }
    ]
  }
  ```

#### Update Custom Role & Matrix
* **Endpoint**: `PUT /api/roles/:id`
* **Body**: Supports updating role metadata and/or the full permissions list (replacing the active matrix records for this role).

#### Delete Custom Role
* **Endpoint**: `DELETE /api/roles/:id`
* **Rule**: Protected system roles (Super Admin, Risk Officer, Compliance, etc.) and roles with users assigned cannot be deleted.

#### Get Global Matrix Data
* **Endpoint**: `GET /api/roles/matrix`
* **Response**: Returns a full structural view of the database matrix: roles, modules, and their cross-mapped actions.

---

### 3. User Management (`/api/users`)

#### Get User List
* **Endpoint**: `GET /api/users`
* **Response**: Lists all admin users, their assigned roles, status, and creator/updater metadata.

#### Create User (Admin Account)
* **Endpoint**: `POST /api/users`
* **Body**:
  ```json
  {
    "username": "janedoe",
    "email": "janedoe@example.com",
    "password": "temporarypassword",
    "roleId": "uuid-of-role",
    "status": "ACTIVE"
  }
  ```

#### Update User (Assign Role / Status)
* **Endpoint**: `PUT /api/users/:id`
* **Body**: Updates username, email, password, role assignment (`roleId`), or active status. Prevents deactivating or demoting the bootstrap Super Admin.

#### Delete User
* **Endpoint**: `DELETE /api/users/:id`
* **Rule**: Cannot delete the bootstrap Super Admin or your own logged-in account.
