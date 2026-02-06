# SpotiRoulette Signaling Server

A simple PeerJS signaling server for SpotiRoulette video chat.

## Local Development

```bash
cd server
npm install
npm start
```

Server will run at `http://localhost:9000/peerjs`

## Deploy to Google Cloud Run

### 1. Authenticate with GCP
```bash
gcloud auth login
gcloud config set project YOUR_GCP_PROJECT_ID
```

### 2. Build and deploy
```bash
cd server

# Build container
gcloud builds submit --tag gcr.io/YOUR_GCP_PROJECT_ID/spotiroulette-signaling

# Deploy to Cloud Run
gcloud run deploy spotiroulette-signaling \
  --image gcr.io/YOUR_GCP_PROJECT_ID/spotiroulette-signaling \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated
```

### 3. Update index.html
After deployment, Cloud Run will give you a URL like:
`https://spotiroulette-signaling-xxxxx-ew.a.run.app`

Update `index.html`:
```javascript
const USE_CUSTOM_SERVER = true;
const CUSTOM_SERVER = {
    host: 'spotiroulette-signaling-xxxxx-ew.a.run.app',
    port: 443,
    path: '/peerjs',
    key: 'spotiroulette',
    secure: true
};
```

## Capacity

This simple server can easily handle 200+ concurrent signaling connections.
The actual video streams are peer-to-peer and don't go through this server.

## Monitoring

Check Cloud Run logs:
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=spotiroulette-signaling" --limit 50
```
