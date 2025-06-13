Here's the fixed version with the missing closing brackets added:

```javascript
{currentActivation.type === 'poll' && (
                    /* Poll display */
                    <div className="space-y-4">
                      <PollStateIndicator state={pollState} />
                      
                      {pollState === 'pending' ? (
                        <div className="text-center text-white">
                          <PlayCircle className="w-12 h-12 mx-auto mb-2" />
                          <p>Poll will start soon...</p>
                        </div>
                      ) : (
                        <PollDisplay
                          options={currentActivation.options || []}
                          votesByText={pollVotesByText}
                          totalVotes={totalVotes}
                          displayType={currentActivation.poll_display_type || 'bar'}
                          resultFormat={currentActivation.poll_result_format || 'percentage'}
                          isLoading={pollLoading}
                        />
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="bg-white/10 backdrop-blur-sm rounded-lg shadow-sm p-6 mb-6 text-center">
              <Clock className="w-12 h-12 text-white/50 mx-auto mb-2" />
              <p className="text-white">Waiting for next question...</p>
            </div>
          )}
        </ErrorBoundary>
        
        {/* Join QR Code */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Join Room</h2>
            <div className="flex items-center text-white/70">
              <Users className="w-5 h-5 mr-2" />
              {players.length} {players.length === 1 ? 'Player' : 'Players'}
            </div>
          </div>
          <QRCodeDisplay url={getJoinUrl()} />
        </div>
      </div>
    </div>
  );
}
```