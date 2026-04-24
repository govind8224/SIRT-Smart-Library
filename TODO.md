# Deployment TODO

## GitHub + Live Deployment Tasks

### Phase 1: Prepare Repository

- [x] Install Git on Windows (in progress)
- [x] Create `.gitignore` (exclude node_modules, .env, .vscode)
- [x] Fix `db.js` hardcoded credentials → use process.env
- [x] Add `package.json` scripts for start/build

### Phase 2: Push to GitHub

- [ ] Initialize git repo
- [ ] Stage all files
- [ ] Commit
- [ ] Create GitHub repo via browser
- [ ] Push to GitHub

### Phase 3: Deploy Live

- [ ] Deploy full-stack app to Render (Netlify cannot run Express/MySQL/Socket.IO)
- [ ] Add environment variables on hosting platform
- [ ] Update CORS if needed
- [ ] Test live URL
