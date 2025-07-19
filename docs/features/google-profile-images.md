# Google Profile Images Feature

## Overview

Alert24 automatically displays users' Google account profile photos when they sign in with Google OAuth. The feature provides visual indicators to distinguish between Google profile photos and default avatars.

## How It Works

### 1. **Google OAuth Integration**

When users sign in with Google, the system:

- Retrieves their profile information including their profile photo URL
- Stores the image URL in the user session as `session.user.image`
- Creates a persistent session that includes the profile photo

### 2. **Image Display Locations**

#### **Navigation Bar (Desktop)**

- Shows 32x32px avatar with user's Google photo
- Green border indicates Google profile photo
- Small verification dot for visual confirmation
- Tooltip shows "Profile (Google Photo)" vs "Profile"

#### **Navigation Bar (Mobile)**

- Hamburger menu includes user profile section
- Shows avatar with "Google Profile" label
- Clean card design with user name and status

#### **Profile Page**

- Large 120x120px avatar display
- Blue border and glow effect for Google photos
- Green checkmark badge for verification
- Status chips: "Google Profile Photo" vs "Default Avatar"
- Helper text for users without profile photos

### 3. **Fallback Behavior**

If a user doesn't have a Google profile photo:

- Shows user's initials in a colored circle
- "Default Avatar" status indicators
- Helper text explaining how to add a profile photo

## Technical Implementation

### **Session Structure**

```javascript
session: {
  user: {
    id: "user-uuid",
    email: "user@example.com",
    name: "User Name",
    image: "https://lh3.googleusercontent.com/..." // Google photo URL
  }
}
```

### **Key Components**

- `app/api/auth/google/callback/route.js` - Captures Google profile data
- `lib/session-manager.js` - Includes image in session token
- `components/NavBar.jsx` - Displays avatar with indicators
- `app/profile/page.js` - Profile page with enhanced avatar display

### **Visual Indicators**

- **Google Photo**: Green border, verification badges, "Google Profile Photo" labels
- **Default Avatar**: Gray styling, user initials, "Default Avatar" labels

## User Experience

### **For Users WITH Google Profile Photos**

✅ See their actual photo in navigation and profile  
✅ Clear visual confirmation it's from Google  
✅ Professional, personalized appearance

### **For Users WITHOUT Google Profile Photos**

✅ Clean default avatar with their initials  
✅ Clear indication it's a default avatar  
✅ Guidance on how to add a profile photo

## Security & Privacy

- **No Local Storage**: Profile photos are loaded directly from Google's CDN
- **Session-Based**: Image URLs are included in secure session tokens
- **Google-Controlled**: Users manage their profile photos through Google Account settings
- **Automatic Updates**: Changes to Google profile photos appear immediately after re-login

## Troubleshooting

### **Profile Photo Not Showing?**

1. Check if user has a profile photo set in their Google Account
2. Verify Google OAuth permissions include profile information
3. Check browser console for image loading errors
4. Ensure session includes `image` field

### **Default Avatar Instead of Google Photo?**

- User may not have a profile photo in their Google Account
- Google Account privacy settings may block profile photo access
- Session may have expired and needs refresh

## Future Enhancements

- **Profile Photo Upload**: Allow users to upload custom profile photos
- **Photo Management**: Direct links to Google Account photo settings
- **Fallback Sources**: Support for Gravatar or other profile photo services
- **Photo Caching**: Local caching for improved performance
