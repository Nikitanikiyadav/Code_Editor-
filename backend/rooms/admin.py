from django.contrib import admin

from .models import CodeVersion, Room, RoomFile, RoomParticipant


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "owner", "language", "updated_at")
    search_fields = ("name", "code")


@admin.register(RoomParticipant)
class RoomParticipantAdmin(admin.ModelAdmin):
    list_display = ("room", "user", "role", "last_opened_at")


@admin.register(RoomFile)
class RoomFileAdmin(admin.ModelAdmin):
    list_display = ("name", "room", "language", "updated_by", "updated_at")


@admin.register(CodeVersion)
class CodeVersionAdmin(admin.ModelAdmin):
    list_display = ("file", "saved_by", "created_at")