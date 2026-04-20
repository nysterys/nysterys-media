import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { fmtDate } from '../../utils/format';

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
    const body = newComment.trim();
    if (!body) return;
    if (body.length > 2000) { alert('Comment must be 2000 characters or fewer.'); return; }
    setLoading(true);
    await supabase.from('comments').insert({
      campaign_id: campaignId,
      author_id: profile.id,
      body,
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

  async function deleteComment(id) {
    if (!window.confirm('Delete this comment?')) return;
    await supabase.from('comments').delete().eq('id', id);
    await fetchComments();
  }

  const isAdmin = profile?.role === 'admin';

  return (
    <div>
      {comments.length === 0 && (
        <div className="text-muted text-sm" style={{ marginBottom: 12 }}>No comments yet.</div>
      )}
      {comments.map(c => (
        <div className="comment" key={c.id} style={{ position: 'relative' }}>
          <div className="comment-avatar">{getInitials(c.author)}</div>
          <div className="comment-body" style={{ flex: 1 }}>
            <div className="comment-meta">
              <strong>{c.author?.full_name || 'Unknown'}</strong>
              {' · '}
              {fmtDate(c.created_at, 'MMM d, h:mm a')}
            </div>
            <div className="comment-text">{c.body}</div>
          </div>
          {isAdmin && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 11, color: 'var(--red, #e74c3c)', flexShrink: 0, alignSelf: 'flex-start', padding: '2px 6px' }}
              onClick={() => deleteComment(c.id)}
              title="Delete comment"
            >✕</button>
          )}
        </div>
      ))}
      <form onSubmit={submitComment} className="comment-input-row">
        <input
          className="form-input"
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          maxLength={2000}
          disabled={loading}
        />
        <button className="btn btn-primary btn-sm" type="submit" disabled={loading || !newComment.trim()}>
          Post
        </button>
      </form>
    </div>
  );
}
