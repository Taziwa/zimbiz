# ZimBiz Full-Stack

This is a Zimbabwe Business Directory, ZimBiz visual frontend real Node/Express + MongoDB backend.

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


## Important next production upgrades


- Add user authentication (customers + business owners)
- Add owner dashboard and role-based access
- Add admin verification workflow
- Add email/WhatsApp notifications
- Add image upload with Cloudinary
- Add abuse/spam protection for reviews and listings
- Add real booking availability per business
- Add payment provider only when monetisation is ready
- Add legal pages, privacy policy, terms and consent logging
