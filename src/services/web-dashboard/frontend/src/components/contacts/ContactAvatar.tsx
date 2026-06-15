import { useState } from 'react'
import { User } from 'lucide-react'
import { avatarLabel } from '../../lib/destinationFormat'

interface Props {
  name: string
  destinationId?: string
  hasProfilePicture?: boolean
  profilePictureUpdatedAt?: string
  size?: number
}

function profilePictureSrc(destinationId: string, updatedAt?: string): string {
  const v = updatedAt ? `?v=${new Date(updatedAt).getTime()}` : ''
  return `/api/destinations/${destinationId}/profile-picture${v}`
}

export function ContactAvatar({
  name,
  destinationId,
  hasProfilePicture,
  profilePictureUpdatedAt,
  size = 44,
}: Props) {
  const [failed, setFailed] = useState(false)

  const storedSrc =
    destinationId && hasProfilePicture && !failed
      ? profilePictureSrc(destinationId, profilePictureUpdatedAt)
      : null

  if (storedSrc) {
    return (
      <img
        src={storedSrc}
        alt=""
        onError={() => setFailed(true)}
        className="rounded-full shrink-0 ring-2 ring-[var(--rz-border)] object-cover bg-[var(--rz-surface-muted)]"
        style={{ width: size, height: size }}
      />
    )
  }

  if (name?.trim()) {
    return (
      <img
        src={avatarLabel(name, size)}
        alt=""
        className="rounded-full shrink-0 ring-2 ring-[var(--rz-border)] object-cover"
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <div
      className="rounded-full shrink-0 ring-2 ring-[var(--rz-border)] bg-[var(--rz-surface-muted)] flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <User size={Math.round(size * 0.45)} className="text-[var(--rz-text-muted)]" />
    </div>
  )
}
