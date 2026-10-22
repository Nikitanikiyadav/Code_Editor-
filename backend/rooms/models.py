import secrets

from django.conf import settings
from django.db import models

# No 0/O or 1/I/L, so codes are easy to read aloud and type
CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 8


def generate_room_code():
    # `secrets` is cryptographically secure. `random` is predictable, so never use it for codes.
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))


class Room(models.Model):
    class Language(models.TextChoices):
        JAVASCRIPT = "javascript", "JavaScript"
        TYPESCRIPT = "typescript", "TypeScript"
        PYTHON = "python", "Python"
        JAVA = "java", "Java"
        CPP = "cpp", "C++"
        C = "c", "C"
        CSHARP = "csharp", "C#"
        GO = "go", "Go"
        RUST = "rust", "Rust"
        PHP = "php", "PHP"
        HTML = "html", "HTML"
        CSS = "css", "CSS"
        SQL = "sql", "SQL"

    name = models.CharField(max_length=80)
    code = models.CharField(max_length=CODE_LENGTH, unique=True, editable=False)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="owned_rooms",
    )
    language = models.CharField(
        max_length=20, choices=Language.choices, default=Language.PYTHON
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)  # changes on every save()

    class Meta:
        ordering = ["-updated_at"]

    def save(self, *args, **kwargs):
        if not self.code:
            # Generate a code that isn't already taken
            for _ in range(10):
                candidate = generate_room_code()
                if not Room.objects.filter(code=candidate).exists():
                    self.code = candidate
                    break
            else:
                raise RuntimeError("Could not generate a unique room code")
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.code})"


class RoomParticipant(models.Model):
    class Role(models.TextChoices):
        OWNER = "owner", "Owner"
        EDITOR = "editor", "Editor"
        VIEWER = "viewer", "Viewer"  # read-only, enforced in Phase 7

    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name="participants")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="room_memberships",
    )
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.EDITOR)
    joined_at = models.DateTimeField(auto_now_add=True)
    last_opened_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            # Database-level rule: a user can be in a room only once
            models.UniqueConstraint(
                fields=["room", "user"], name="unique_room_participant"
            )
        ]

    def __str__(self):
        return f"{self.user} in {self.room} as {self.role}"