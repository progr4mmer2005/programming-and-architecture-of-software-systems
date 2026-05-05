from rest_framework import serializers
from .models import Comment


class CommentSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source='author.get_full_name', read_only=True, default='')
    author_role = serializers.CharField(source='author.role', read_only=True, default='')

    class Meta:
        model = Comment
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at', 'organization', 'author']