import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { format } from 'date-fns';

export default function Comments({ campaignId }) {
  const { profile } = useAuth();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (campaignId) fetchComments();
  }, [campaignId]);

  async function fetchComments() {
    const { data } = await supabase
      .from('comments')
      .select('*, author:profiles(full_name, creator_name, role)')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: true });
    setComments(data || []);
  }

  async function submitComment(e) {
    e.preventDefault();
    if (!newComment.trim()) return;
    setLoading(true);
    await supabase.from('comments').insert({
      campaign_id: campaignId,
      author_id: profile.id,
      body: newComment.trim(),
    });
    setNewComment('');
    await fetchComments();
    setLoading(false);
  }

  function getInitials(p) {
    if (!p) return '?';
    const name = p.full_name || '';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  return (
    <div>
      {comments.length === 0 && (
        <div className="text-muted text-sm" style={{ marginBottom: 12 }}>No comments yet.</div>
      )}
      {comments.map(c => (
        <div className="comment" key={c.id}>
          <div className="comment-avatar">{getInitials(c.author)}</div>
          <div className="comment-body">
            <div className="comment-meta">
              <strong>{c.author?.full_name || 'Unknown'}</strong>
              {' · '}
              {format(new Date(c.created_at), 'MMM d, h:mm a')}
            </div>
            <div className="comment-text">{c.body}</div>
          </div>
        </div>
      ))}
      <form onSubmit={submitComment} className="comment-input-row">
        <input
          className="form-input"
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          disabled={loading}
        />
        <button className="btn btn-primary btn-sm" type="submit" disabled={loading || !newComment.trim()}>
          Post
        </button>
      </form>
    </div>
  );
}
