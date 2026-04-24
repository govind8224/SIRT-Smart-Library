# Deployment TODO

## GitHub + Live Deployment Tasks

### Phase 1: Prepare Repository ✅

- [x] Install Git on Windows
- [x] Create `.gitignore` (exclude node_modules, .env, .vscode)
- [x] Fix `db.js` hardcoded credentials → use process.env
- [x] Add `package.json` scripts for start/build
- [x] Create `netlify.toml` for frontend deployment config
- [x] Create `README.md`

### Phase 2: Push to GitHub ⏳

- [x] Initialize git repo
- [x] Stage all files
- [x] Commit
- [ ] Authenticate with GitHub (requires your action - see below)
- [ ] Create GitHub repo
- [ ] Push to GitHub

### Phase 3: Deploy Live ⏳

- [ ] Deploy frontend to Netlify
- [ ] Deploy backend to Render/Railway
- [ ] Add environment variables on hosting platform
- [ ] Update CORS if needed
- [ ] Test live URL

---

## Remaining Steps for You:

### 1. GitHub Authentication (Required - I cannot do this without your credentials)

Open your VSCode terminal and run:

```powershell
$env:Path += ";C:\Program Files\GitHub CLI"; gh auth login
```

Follow the browser prompts to log in.

### 2. Create GitHub Repo & Push

After auth, run in terminal:

```powershell
cd "c:/Users/HP 745 G6/OneDrive/web_dev/Library"
$env:Path += ";C:\Program Files\GitHub CLI"; $env:Path += ";C:\Program Files\Git\bin"
gh repo create sirt-smart-library --public --source=. --push
```

### 3. Deploy Frontend to Netlify

Go to https://app.netlify.com/ → Add new site → Import from GitHub → Select repo → Set publish directory to `public`

### 4. Deploy Backend to Render

Go to https://render.com/ → New Web Service → Connect GitHub repo → Set start command to `npm start` → Add environment variables
