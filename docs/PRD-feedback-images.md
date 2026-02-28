# PRD: Image Upload in Feedback

## Overview
Allow users to upload images when submitting feedback. This helps users provide visual context for bugs or feature requests.

## User Story
As a user submitting feedback, I want to attach screenshots or photos so the team can better understand my issue or suggestion.

## Requirements

### 1. Image Upload UI

Add image upload capability to the feedback form:

```
┌─────────────────────────────────────────────┐
│  Send Feedback                               │
│                                              │
│  Type: [Bug ▼]                               │
│                                              │
│  Title: [____________________]               │
│                                              │
│  Description:                                │
│  ┌─────────────────────────────────────┐    │
│  │                                     │    │
│  │                                     │    │
│  └─────────────────────────────────────┘    │
│                                              │
│  📎 Attachments:                             │
│  ┌────┐ ┌────┐ ┌────┐                       │
│  │ 🖼️ │ │ 🖼️ │ │ +  │                       │
│  │img1│ │img2│ │    │                       │
│  └────┘ └────┘ └────┘                       │
│                                              │
│            [Cancel]  [Submit Feedback]       │
└─────────────────────────────────────────────┘
```

Features:
- Click "+" or drag-and-drop to add images
- Preview thumbnails of attached images
- Click X to remove an image
- Max 3 images per feedback
- Supported formats: JPG, PNG, GIF, WebP
- Max file size: 5MB per image

### 2. Storage

Use Supabase Storage:
- Bucket: `feedback-attachments`
- Path: `{user_id}/{feedback_id}/{filename}`
- Public access: false (read via API only)
- RLS: Users can only read their own attachments

### 3. Database Changes

```sql
-- Create attachments table
CREATE TABLE feedback_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL REFERENCES feedback(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  storage_path text NOT NULL,
  filename text NOT NULL,
  content_type text NOT NULL,
  size_bytes integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_feedback_attachments_feedback ON feedback_attachments(feedback_id);

-- RLS policies
ALTER TABLE feedback_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_see_own_attachments" ON feedback_attachments
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "users_can_create_own_attachments" ON feedback_attachments
  FOR INSERT WITH CHECK (user_id = auth.uid());
```

### 4. API Endpoints

**POST /api/v1/feedback/upload**
Get a signed URL for uploading an image to Supabase Storage.
Request: `{ "filename": "screenshot.png", "contentType": "image/png" }`
Response: `{ "uploadUrl": "...", "storagePath": "..." }`

**POST /api/v1/feedback**
Update to accept `attachmentPaths: string[]` and associate them with the feedback.

**GET /api/v1/feedback/:id/attachments**
List attachments for a feedback item (owner only, or admin).
Response: `[{ id, filename, url, sizeBytes, contentType }]`

### 5. UI Components

**ImageUpload component** (`src/components/feedback/image-upload.tsx`):
- Drag-and-drop zone
- File input fallback
- Image preview grid
- Progress indicator during upload
- Error handling (too large, wrong type)

**Updated FeedbackForm** (`src/components/feedback/feedback-form.tsx`):
- Include ImageUpload component
- Pass attachment paths on submit
- Show loading state during upload

### 6. Admin View

For internal/admin review of feedback:
- Display thumbnails inline with feedback
- Click to enlarge
- Download original file

## Security Considerations

- File type validation (MIME type and magic bytes)
- File size limits
- Scan for malware (if possible, or rely on Supabase)
- RLS policies ensure users only access their own uploads
- Admin access for reviewing feedback attachments

## Error Handling

- File too large: "Image must be under 5MB"
- Invalid type: "Only JPG, PNG, GIF, and WebP images are allowed"
- Upload failed: "Failed to upload image. Please try again."
- Network error: Retry with exponential backoff

## Success Criteria

- [ ] Users can attach up to 3 images to feedback
- [ ] Drag-and-drop and click-to-upload both work
- [ ] Image previews shown before submission
- [ ] Images stored securely in Supabase Storage
- [ ] Feedback includes image metadata and URLs
- [ ] Images display in admin feedback view
- [ ] TypeScript compiles clean (`npx tsc --noEmit`)

## Future Enhancements

- Annotate images (draw arrows, add text)
- Video attachments (for screen recordings)
- Automatic screenshot on error (with user consent)

## Commit Message
`feat: image upload support in feedback form`
