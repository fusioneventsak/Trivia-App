import React, { useState, useEffect, useRef } from 'react';
                                  </div>
                                )}
                                <div className="flex-1 font-medium">{option.text}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        /* Show poll results when voting or closed */
                        <PollDisplay
                          options={currentActivation.options || []}
                          votesByText={pollVotesByText}
                          totalVotes={totalVotes}
                          displayType={currentActivation.poll_display_type || 'bar'}
                          resultFormat={currentActivation.poll_result_format || 'percentage'}
                          isLoading={pollLoading}
                          lastUpdated={pollLastUpdated}
                          pollingInterval={pollingInterval}
                        />
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            /* No active question/poll */
            <div className="bg-white/10 backdrop-blur-sm rounded-lg shadow-sm p-6 mb-6 text-center">
              <h2 className="text-xl font-semibold text-white mb-2">Join the Game!</h2>
              <p className="text-white/80 mb-4">Scan the QR code or visit the URL below to join</p>
              <div className="flex justify-center mb-4">
                <QRCodeDisplay url={getJoinUrl()} size={200} />
              </div>
              <p className="text-white/60 text-sm">{getJoinUrl()}</p>
            </div>
          )}
        </ErrorBoundary>
        
        {/* Player List */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-white/80" />
              <h2 className="text-lg font-semibold text-white">Players ({players.length})</h2>
            </div>
            <button
              onClick={() => setActivationRefreshCount(prev => prev + 1)}
              className="p-2 text-white/80 hover:text-white transition-colors"
              title="Refresh data"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
          
          <div className="space-y-2">
            {players.map((player) => (
              <div
                key={player.id}
                className="flex items-center justify-between p-3 rounded-lg bg-white/20"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 text-white font-medium">
                    {playerRankings[player.id]}
                  </div>
                  <span className="text-white font-medium">{player.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-300" />
                  <span className="text-white font-bold">{player.score}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}