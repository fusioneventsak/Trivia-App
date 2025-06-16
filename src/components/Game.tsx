import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePollManager } from '../hooks/usePollManager';
import { supabase } from '../lib/supabase';
import { useGameStore } from '../store/gameStore';
import { useTheme } from '../context/ThemeContext';