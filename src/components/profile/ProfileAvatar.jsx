import { useMemo, useState } from "react";

function getInitials(name = "", email = "") {
  const source = name.trim() || email.split("@")[0] || "User";
  const words = source.split(/\s+/).filter(Boolean);

  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

function ProfileAvatar({ user, size = "md", className = "", previewURL = "" }) {
  const source = previewURL || user?.photoURL || "";
  const [failedSource, setFailedSource] = useState("");
  const initials = useMemo(
    () => getInitials(user?.displayName, user?.email),
    [user?.displayName, user?.email]
  );

  return (
    <span
      className={`profile-avatar profile-avatar--${size} ${className}`.trim()}
      aria-hidden="true"
    >
      {source && failedSource !== source ? (
        <img
          src={source}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailedSource(source)}
        />
      ) : (
        <span>{initials}</span>
      )}
    </span>
  );
}

export default ProfileAvatar;
