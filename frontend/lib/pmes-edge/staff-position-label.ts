/** Maps Prisma `StaffUser.role` to a short registry label. */
export function staffPositionLabel(role: string | null | undefined): string | null {
  if (role == null || role === "") return null;
  switch (role) {
    case "SUPERUSER":
      return "Superuser";
    case "ADMIN":
      return "Admin";
    case "TREASURER":
      return "Treasurer";
    case "BOARD_DIRECTOR":
      return "Board director";
    case "SECRETARY":
      return "Secretary";
    default:
      return role;
  }
}
