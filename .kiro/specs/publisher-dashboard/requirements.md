# Requirements Document

## Introduction

The Publisher Dashboard is a comprehensive admin panel for the OORUM URAVUM Tamil news platform. It enhances the existing `/admin/*` frontend pages to become a fully functional content management system. Publishers can create and manage articles, organize categories and menus, control the home page layout and section ordering, manage media, obituaries, tags, users, comments, and site settings — all through a single dashboard. The dashboard reuses the existing Express.js backend API (port 4000) and upgrades the current placeholder Next.js admin pages into production-ready interfaces.

## Glossary

- **Dashboard**: The main `/admin` page showing article counts, recent activity, and quick actions
- **Article_Editor**: The admin interface for creating and editing articles with rich text, featured images, tags, category selection, and status management
- **Category_Manager**: The admin interface for creating, editing, deleting, and organizing categories in a hierarchical tree structure
- **Home_Layout_Manager**: The admin interface for configuring which sections appear on the public home page and their display order
- **Media_Library**: The admin interface for uploading, browsing, and managing images
- **Obituary_Manager**: The admin interface for creating and managing obituary entries
- **Tag_Manager**: The admin interface for creating, editing, and deleting tags
- **User_Manager**: The admin interface for creating, editing, and deleting user accounts with role assignment
- **Comment_Moderator**: The admin interface for reviewing, approving, and rejecting user comments
- **Settings_Panel**: The admin interface for managing site-wide settings (title, description, social links, analytics)
- **Sidebar_Navigation**: The left sidebar menu in the admin layout providing navigation to all dashboard sections
- **Publisher**: An authenticated user with ADMIN, EDITOR, or AUTHOR role who accesses the dashboard
- **RBAC**: Role-Based Access Control — the system that restricts features based on user roles (ADMIN, EDITOR, AUTHOR)
- **Backend_API**: The existing Express.js REST API at `http://localhost:4000/api/*`
- **SiteSetting**: A key-value pair stored in the database for site configuration

## Requirements

### Requirement 1: Article Management

**User Story:** As a Publisher, I want to create, edit, publish, and archive articles from the dashboard, so that I can manage all news content in one place.

#### Acceptance Criteria

1. WHEN the Publisher navigates to the Articles page, THE Article_Editor SHALL display a paginated list of articles with title, author, category, status, and last updated date
2. WHEN the Publisher clicks "New Article", THE Article_Editor SHALL display a form with fields for title, content (rich text), excerpt, category (dropdown populated from Backend_API), tags (multi-select populated from Backend_API), featured image (selectable from Media_Library), breaking news toggle, and status selection
3. WHEN the Publisher submits a new article form with valid data, THE Article_Editor SHALL send a POST request to `/api/articles` on the Backend_API and display the created article in the list
4. WHEN the Publisher clicks "Edit" on an existing article, THE Article_Editor SHALL populate the form with the article data fetched from the Backend_API and allow modifications
5. WHEN the Publisher changes an article status via the inline dropdown, THE Article_Editor SHALL send a PUT request to `/api/articles/:id` on the Backend_API with the new status
6. WHEN the Publisher applies a status filter (All, Draft, Published, Archived), THE Article_Editor SHALL fetch and display only articles matching the selected status
7. IF the Backend_API returns a validation error on article creation or update, THEN THE Article_Editor SHALL display the error message to the Publisher
8. WHILE the Publisher has the AUTHOR role, THE Article_Editor SHALL restrict editing to articles authored by the logged-in Publisher only

### Requirement 2: Category and Menu Management

**User Story:** As a Publisher, I want to create, edit, delete, and organize categories with parent-child hierarchy, so that I can structure the site navigation and content organization.

#### Acceptance Criteria

1. WHEN the Publisher navigates to the Categories page, THE Category_Manager SHALL display all categories in a table showing name, slug, description, parent category, and article count
2. WHEN the Publisher clicks "New Category", THE Category_Manager SHALL display a form with fields for name, description, and parent category (dropdown of existing categories)
3. WHEN the Publisher submits a new category with valid data, THE Category_Manager SHALL send a POST request to `/api/categories` on the Backend_API and refresh the category list
4. WHEN the Publisher clicks "Edit" on a category, THE Category_Manager SHALL populate the form with the category data and allow modifications via PUT request to `/api/categories/:id`
5. WHEN the Publisher clicks "Delete" on a category, THE Category_Manager SHALL display a confirmation dialog before sending a DELETE request to `/api/categories/:id`
6. IF the Backend_API returns an HAS_ARTICLES error on category deletion, THEN THE Category_Manager SHALL display a message indicating the category has associated articles that must be reassigned first
7. WHILE the Publisher has the AUTHOR role, THE Category_Manager SHALL hide the create, edit, and delete actions

### Requirement 3: Home Page Layout Management

**User Story:** As a Publisher, I want to control which sections appear on the public home page and their display order, so that I can customize the site layout without code changes.

#### Acceptance Criteria

1. THE Home_Layout_Manager SHALL display a list of configurable home page sections: Ticker, Hero Section, Topic Cards, Latest News, Obituary Section, Advertisement Sidebar, and Archive Sidebar
2. WHEN the Publisher toggles a section on or off, THE Home_Layout_Manager SHALL store the visibility state as a SiteSetting via PUT request to `/api/settings` on the Backend_API
3. WHEN the Publisher reorders sections using drag-and-drop or up/down controls, THE Home_Layout_Manager SHALL store the section order as a SiteSetting via PUT request to `/api/settings` on the Backend_API
4. WHEN the public home page loads, THE Home_Layout_Manager settings SHALL determine which sections are rendered and in what order
5. WHILE the Publisher has the AUTHOR or EDITOR role, THE Home_Layout_Manager SHALL be hidden from the Sidebar_Navigation (ADMIN only)

### Requirement 4: Site Settings Management

**User Story:** As a Publisher, I want to manage site-wide settings like title, description, and social links, so that I can update the site identity without developer assistance.

#### Acceptance Criteria

1. WHEN the Publisher navigates to the Settings page, THE Settings_Panel SHALL display a form pre-populated with current values for site title, site description, Facebook URL, Twitter URL, Instagram URL, and analytics ID fetched from the Backend_API
2. WHEN the Publisher submits the settings form with valid data, THE Settings_Panel SHALL send a PUT request to `/api/settings` on the Backend_API and display a success confirmation
3. IF the Backend_API returns a validation error on settings update, THEN THE Settings_Panel SHALL display the error message to the Publisher
4. WHILE the Publisher has a role other than ADMIN, THE Settings_Panel SHALL display an "Admin access required" message and hide the form

### Requirement 5: Media Library Management

**User Story:** As a Publisher, I want to upload, browse, and manage images, so that I can use them as featured images in articles.

#### Acceptance Criteria

1. WHEN the Publisher navigates to the Media page, THE Media_Library SHALL display all uploaded images in a responsive grid showing thumbnail, filename, and file size
2. WHEN the Publisher selects a file and clicks "Upload", THE Media_Library SHALL send the file as a multipart POST request to `/api/media/upload` on the Backend_API and add the new image to the grid
3. IF the uploaded file exceeds 10MB or has an unsupported format, THEN THE Media_Library SHALL display the error message returned by the Backend_API
4. WHEN the Publisher clicks on a media item, THE Media_Library SHALL display a detail view with original, thumbnail, medium, and large variant URLs for copying

### Requirement 6: Obituary Management

**User Story:** As a Publisher, I want to create and manage obituary entries, so that I can publish tributes on the site.

#### Acceptance Criteria

1. WHEN the Publisher navigates to the Obituaries page, THE Obituary_Manager SHALL display a paginated list of obituaries with name, content preview, published date, and image thumbnail
2. WHEN the Publisher clicks "New Obituary", THE Obituary_Manager SHALL display a form with fields for name, content, image upload, and published date
3. WHEN the Publisher submits a new obituary with valid data, THE Obituary_Manager SHALL send a POST request to the Backend_API and refresh the list
4. WHEN the Publisher clicks "Edit" on an obituary, THE Obituary_Manager SHALL populate the form with existing data and allow modifications
5. WHEN the Publisher clicks "Delete" on an obituary, THE Obituary_Manager SHALL display a confirmation dialog before sending a DELETE request

### Requirement 7: Tag Management

**User Story:** As a Publisher, I want to create and manage tags, so that I can organize articles with cross-cutting labels.

#### Acceptance Criteria

1. WHEN the Publisher navigates to the Tags page, THE Tag_Manager SHALL display all tags in a table showing name and slug
2. WHEN the Publisher clicks "New Tag" and submits a name, THE Tag_Manager SHALL send a POST request to `/api/tags` on the Backend_API and refresh the tag list
3. WHEN the Publisher clicks "Edit" on a tag, THE Tag_Manager SHALL allow inline editing of the tag name via PUT request to `/api/tags/:id`
4. WHEN the Publisher clicks "Delete" on a tag, THE Tag_Manager SHALL display a confirmation dialog before sending a DELETE request to `/api/tags/:id`
5. WHILE the Publisher has the AUTHOR role, THE Tag_Manager SHALL hide the create, edit, and delete actions

### Requirement 8: User Management

**User Story:** As an Admin, I want to create, edit, and delete user accounts with role assignment, so that I can control who has access to the dashboard.

#### Acceptance Criteria

1. WHEN the Admin navigates to the Users page, THE User_Manager SHALL display a paginated list of users with name, email, role, and creation date
2. WHEN the Admin clicks "New User", THE User_Manager SHALL display a form with fields for name, email, password, and role (ADMIN, EDITOR, AUTHOR)
3. WHEN the Admin submits a new user form with valid data, THE User_Manager SHALL send a POST request to `/api/users` on the Backend_API and refresh the user list
4. WHEN the Admin clicks "Edit" on a user, THE User_Manager SHALL populate the form with user data and allow modifications (password field optional on edit)
5. WHEN the Admin clicks "Delete" on a user, THE User_Manager SHALL display a confirmation dialog before sending a DELETE request to `/api/users/:id`
6. IF the Backend_API returns a DUPLICATE_EMAIL error, THEN THE User_Manager SHALL display a message indicating the email is already in use
7. IF the Backend_API returns a HAS_ARTICLES error on user deletion, THEN THE User_Manager SHALL display a message indicating the user has associated articles that must be reassigned first
8. WHILE the Publisher has a role other than ADMIN, THE User_Manager SHALL display an "Admin access required" message

### Requirement 9: Comment Moderation

**User Story:** As a Publisher, I want to review, approve, and reject comments, so that I can maintain content quality on the site.

#### Acceptance Criteria

1. WHEN the Publisher navigates to the Comments page, THE Comment_Moderator SHALL display comments filtered by status (default: Pending) with commenter name, email, content, status badge, and timestamp
2. WHEN the Publisher clicks "Approve" on a pending or flagged comment, THE Comment_Moderator SHALL send a PUT request to `/api/comments/:id/approve` on the Backend_API and update the status badge
3. WHEN the Publisher clicks "Reject" on a pending or flagged comment, THE Comment_Moderator SHALL send a PUT request to `/api/comments/:id/reject` on the Backend_API and update the status badge
4. WHEN the Publisher selects a status filter (Pending, Flagged, All), THE Comment_Moderator SHALL fetch and display only comments matching the selected filter
5. WHILE the Publisher has the AUTHOR role, THE Comment_Moderator SHALL be hidden from the Sidebar_Navigation

### Requirement 10: Dashboard Overview

**User Story:** As a Publisher, I want to see an overview of content status and recent activity when I log in, so that I can quickly understand the state of the site.

#### Acceptance Criteria

1. WHEN the Publisher navigates to the Dashboard page, THE Dashboard SHALL display count cards for Draft, Published, and Archived articles fetched from the Backend_API
2. WHEN the Publisher navigates to the Dashboard page, THE Dashboard SHALL display a list of the 5 most recently updated articles with title, status badge, and date
3. THE Dashboard SHALL display quick action links to create a new article and navigate to category management
4. IF the Backend_API is unreachable, THEN THE Dashboard SHALL display placeholder values and continue rendering without errors

### Requirement 11: Admin Layout and Navigation

**User Story:** As a Publisher, I want a consistent sidebar navigation and layout across all admin pages, so that I can move between sections efficiently.

#### Acceptance Criteria

1. THE Sidebar_Navigation SHALL display navigation links for: Dashboard, Articles, Categories, Tags, Users, Media, Comments, Obituaries, Home Layout, and Settings
2. WHILE the Publisher is on a specific admin page, THE Sidebar_Navigation SHALL visually highlight the active navigation link
3. WHILE the Publisher has the AUTHOR role, THE Sidebar_Navigation SHALL hide links to Users, Comments, Settings, and Home Layout sections
4. WHILE the Publisher has the EDITOR role, THE Sidebar_Navigation SHALL hide links to Users, Settings, and Home Layout sections
5. THE Sidebar_Navigation SHALL display the logged-in Publisher name and role in the sidebar header
6. WHEN the Publisher clicks "Logout", THE Sidebar_Navigation SHALL clear the authentication token and redirect to the login form

### Requirement 12: Authentication and Access Control

**User Story:** As a Publisher, I want to log in securely and have my access restricted based on my role, so that the dashboard enforces proper permissions.

#### Acceptance Criteria

1. WHEN an unauthenticated user navigates to any `/admin/*` route, THE Dashboard SHALL display the login form
2. WHEN the Publisher submits valid credentials, THE Dashboard SHALL store the JWT access token and user data in localStorage and display the admin interface
3. IF the Publisher submits invalid credentials, THEN THE Dashboard SHALL display the error message returned by the Backend_API
4. IF the Publisher account is locked due to failed login attempts, THEN THE Dashboard SHALL display the account locked message returned by the Backend_API
5. THE Dashboard SHALL include the JWT token as a Bearer token in the Authorization header of every request to the Backend_API
6. WHILE the Publisher has the AUTHOR role, THE Dashboard SHALL prevent access to admin-only pages (Users, Settings, Home Layout) by displaying an access denied message
