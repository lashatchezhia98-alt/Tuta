export function validDoctorPhoto(id, doctorId) {
  return (
    typeof id === "string" &&
    /^[0-9a-f-]{36}$/.test(doctorId) &&
    new RegExp(`^tuta-doctors/${doctorId}/[0-9a-f-]{36}$`).test(id)
  );
}
export function doctorPhotoUrl(cloudName, doctor, anonymous = false) {
  if (
    anonymous ||
    !doctor ||
    !/^[a-zA-Z0-9_-]+$/.test(cloudName || "") ||
    !validDoctorPhoto(doctor.photo_public_id, doctor.user_id)
  )
    return null;
  return `https://res.cloudinary.com/${cloudName}/image/upload/c_fill,g_face,w_160,h_160,f_auto,q_auto/${doctor.photo_public_id}`;
}
