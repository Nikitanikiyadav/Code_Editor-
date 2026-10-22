from django.contrib import admin

from .models import Room, RoomParticipant


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "owner", "language", "updated_at")
    search_fields = ("name", "code")


@admin.register(RoomParticipant)
class RoomParticipantAdmin(admin.ModelAdmin):
    list_display = ("room", "user", "role", "last_opened_at")