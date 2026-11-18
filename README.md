# NovaWorks AI Project Manager (Infinity Hack '26)

**Team:** [Bug Hunters]
**Members:** [Hamna Arshad], [Haleema Azeem]

## Stack

- Backend: Node.js, Express, express-session, cors
- Database: SQLite via sql.js (file: `crm.db`)
- Auth: bcryptjs password hashing, session login
- AI: OpenRouter (default model `openrouter/free`)
- Frontend: [Frontend stack, e.g. HTML/JS or React]

## Working Features

- Login and logout with demo accounts
- Admin: see all projects, create projects and tasks from a meeting transcript
- Manager: sees only their own projects
- Agent: sees only projects that contain their assigned tasks, and only their own tasks
- Team directory (read-only)
- Project detail with client, manager, deadline, and tasks
- Data is saved in `crm.db` and survives a refresh

## Setup

1. Install Node.js (v18 or newer).
2. Open the project folder.
3. Install packages:

   ```powershell
   npm install
   ```

4. Set your OpenRouter key (do not commit it):

   ```powershell
   $env:OPENROUTER_API_KEY="sk-or-v1-your-key"
   ```

5. Create the database and demo users:

   ```powershell
   node seed.js
   ```

   Expected output: `Seed complete. Users in database: 10`

6. Start the server:

   ```powershell
   node server.js
   ```

   Expected output: `Server running on http://localhost:3000`

## Demo Accounts

All accounts use the password **Demo123!**

| Role    | Email                    | Name        |
| :------ | :----------------------- | :---------- |
| Admin   | admin@novaworks.example  | Admin       |
| Manager | ayesha@novaworks.example | Ayesha Khan |
| Manager | bilal@novaworks.example  | Bilal Ahmed |
| Manager | hina@novaworks.example   | Hina Malik  |
| Agent   | ali@novaworks.example    | Ali Raza    |
| Agent   | hamza@novaworks.example  | Hamza Shah  |
| Agent   | sara@novaworks.example   | Sara Noor   |
| Agent   | usman@novaworks.example  | Usman Tariq |
| Agent   | zain@novaworks.example   | Zain Abbas  |
| Agent   | maryam@novaworks.example | Maryam Asif |

## Transcript Test

1. Make sure `transcript.txt` is in the project folder (meeting transcript from the challenge pack, Section 7).
2. Log in as admin and send the transcript:

   ```powershell
   $s = New-Object Microsoft.PowerShell.Commands.WebRequestSession
   Invoke-RestMethod -Uri http://localhost:3000/api/login -Method POST -ContentType "application/json" -Body '{"email":"admin@novaworks.example","password":"Demo123!"}' -WebSession $s
   $text = [System.IO.File]::ReadAllText("$PWD\transcript.txt")
   $body = @{ transcript = [string]$text } | ConvertTo-Json
   Invoke-RestMethod -Uri http://localhost:3000/api/create-from-transcript -Method POST -ContentType "application/json" -Body $body -WebSession $s
   ```

3. Expected result: `projectsCreated: 3`, `tasksCreated: 12`.
4. Verify: 3 projects (UrbanCart Website, QuickServe Mobile App, HelpDeskPro AI Assistant) with 40, 46, and 38 total task hours.

Run the transcript test only once per fresh database, because re-running it adds projects again.

## API Endpoints

| Method | Endpoint                    | Access                        |
| :----- | :-------------------------- | :---------------------------- |
| POST   | /api/login                  | Public                        |
| POST   | /api/logout                 | Logged in                     |
| GET    | /api/me                     | Logged in                     |
| GET    | /api/users                  | Logged in                     |
| GET    | /api/projects               | Role-based                    |
| GET    | /api/projects/:id           | Role-based (404 if no access) |
| POST   | /api/create-from-transcript | Admin only                    |

## Known Limitations

- Sessions are stored in server memory. Restarting the server logs everyone out.
- The database file is local (`crm.db`). No hosted deployment yet.
- Edit and delete for projects and tasks are not implemented.
- The AI model is a free model, so output quality and speed can vary. Validation rejects invalid output before anything is saved.
- Frontend runs on a separate port and uses CORS with session cookies.
