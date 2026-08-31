# ZimBiz Full-Stack Starter

This keeps the original ZimBiz visual frontend and adds a real Node/Express + MongoDB backend.

## What is now real

- Search and filtering through `/api/businesses`
- Business detail profiles
- Click tracking
- Quote request storage
- Booking request storage
- Business listing submission
- Reviews + automatic rating recalculation
- Live stats endpoint
- WhatsApp deep links
- Browser saved-business bookmarks
- Demo business photos
- Real Leaflet/OpenStreetMap map pins
- Graceful fallback to the original mock data when MongoDB is not connected

## Recommended production architecture

- Frontend + API: Render Web Service (free tier for a portfolio/prototype)
- Database: MongoDB Atlas Free cluster
- Images: Cloudinary Free for uploaded business photos later
- Git: GitHub

Render's free web service can host Node/Express but spins down after 15 minutes of no inbound traffic and can take about a minute to wake. Its local filesystem is ephemeral, so do not store uploaded images or important data there. Keep business data in MongoDB and media in Cloudinary.

## Local setup

1. Install Node.js 20+.
2. Create a MongoDB Atlas Free cluster.
3. Copy `.env.example` to `.env`.
4. Put your Atlas connection string in `MONGODB_URI`.
5. Run:

```bash
npm install
npm run seed
npm start
```

Open http://localhost:10000

## MongoDB Atlas

In Atlas:
- Create a Free cluster.
- Create a database user.
- Add your current IP during development.
- For a hosted Render service, use the appropriate network access rule required by your deployment. Avoid exposing more access than necessary.

## GitHub

```bash
git init
git add .
git commit -m "Build ZimBiz full stack"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/zimbiz.git
git push -u origin main
```

## Render

1. Create a new Web Service.
2. Connect the GitHub repository.
3. Build command: `npm install`
4. Start command: `npm start`
5. Add environment variable:
   `MONGODB_URI=your Atlas connection string`
6. Add:
   `CLIENT_URL=https://your-render-domain.onrender.com`
7. Deploy.

The service should expose a URL like:
`https://your-service-name.onrender.com`

## Important next production upgrades

Before taking real customer data:
- Add user authentication (customers + business owners)
- Add owner dashboard and role-based access
- Add admin verification workflow
- Add email/WhatsApp notifications
- Add image upload with Cloudinary
- Add abuse/spam protection for reviews and listings
- Add real booking availability per business
- Add payment provider only when monetisation is ready
- Add legal pages, privacy policy, terms and consent logging
