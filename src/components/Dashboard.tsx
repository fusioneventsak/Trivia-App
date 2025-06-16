import React from 'react';
import { usePollManager, PollOption } from '../hooks/usePollManager';

interface DashboardProps {
  activationId: string;
  options: PollOption[];
  playerId: string;
  roomId?: string;
}

const Dashboard: React.FC<DashboardProps> = ({
  activationId,
  options,
  playerId,
  roomId
}) => {
  const {
    votesByText,
    totalVotes,
    hasVoted,
    selectedOptionId,
    pollState,
    isLoading,
    submitVote
  } = usePollManager({
    activationId,
    options,
    playerId,
    roomId
  });

  if (isLoading) return <p>Loading poll…</p>;

  if (pollState === 'voting') {
    return (
      <div>
        <h2>Vote now!</h2>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {options.map(opt => (
            <li key={opt.id} style={{ marginBottom: 8 }}>
              <button
                disabled={hasVoted}
                onClick={() => submitVote(opt.id!)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  cursor: hasVoted ? 'not-allowed' : 'pointer',
                  background:
                    selectedOptionId === opt.id ? '#4caf50' : '#1976d2',
                  color: '#fff',
                  border: 0
                }}
              >
                {opt.text}
              </button>
            </li>
          ))}
        </ul>
        {hasVoted && <p>Thanks — your vote has been recorded!</p>}
      </div>
    );
  }

  /* pollState === 'closed' OR 'pending' with results available */
  return (
    <div>
      <h2>Results</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {Object.entries(votesByText).map(([text, count]) => (
          <li key={text} style={{ marginBottom: 4 }}>
            {text}: {count}
          </li>
        ))}
      </ul>
      <p>Total votes: {totalVotes}</p>
      {pollState === 'pending' && <p>Poll hasn't opened yet.</p>}
    </div>
  );
};

export default Dashboard;