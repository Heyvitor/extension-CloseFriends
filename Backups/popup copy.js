// ================ 1) State Management ================
let currentState = 'loading'; // loading, login, key-input, connected
let isProcessing = false;
let currentKey = null;
let currentAfter = null;
let followersCollected = 0;
let lastFollowerAdded = null;
let lastFollowerId = null;
let instagramCookies = null; // Add this to store cookies globally
let countSaveProgress = 0; // Add counter for save progress

// ================ 2) UI Elements ================
const loadingState = document.getElementById('loading-state');
const loginState = document.getElementById('login-state');
const keyInputState = document.getElementById('key-input-state');
const connectedState = document.getElementById('connected-state');
const keyInput = document.getElementById('key-input');
const validateKeyButton = document.getElementById('validate-key');
const startButton = document.getElementById('start-button');
const pauseButton = document.getElementById('pause-button');
const continueButton = document.getElementById('continue-button');
const stopButton = document.getElementById('stop-button');
const progressCount = document.getElementById('progress-count');
const toast = document.getElementById('toast');

// ================ 3) Helper Functions ================
function getProxiedImageUrl(originalUrl) {
  const servidor = "https://phosphor.ivanenko.workers.dev/";
  return `${servidor}?url=${encodeURIComponent(originalUrl)}`;
}

function showToast(message, type = 'success') {
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => {
    toast.className = 'toast';
  }, 3000);
}

function updateUIState(state) {
  currentState = state;
  loadingState.style.display = 'none';
  loginState.style.display = 'none';
  keyInputState.style.display = 'none';
  connectedState.style.display = 'none';

  switch (state) {
    case 'loading':
      loadingState.style.display = 'flex';
      break;
    case 'login':
      loginState.style.display = 'flex';
      break;
    case 'key-input':
      keyInputState.style.display = 'flex';
      break;
    case 'connected':
      connectedState.style.display = 'flex';
      break;
  }
}

function updateProgressUI() {
  progressCount.textContent = followersCollected;
}

function updateButtonStates(state) {
  startButton.style.display = state === 'initial' ? 'block' : 'none';
  pauseButton.style.display = state === 'running' ? 'block' : 'none';
  continueButton.style.display = state === 'paused' ? 'block' : 'none';
  stopButton.style.display = state === 'running' || state === 'paused' ? 'block' : 'none';
}

function showConnectedState(accountInfo) {
  // Update profile information
  document.getElementById('username').textContent = `@${accountInfo.username}`;
  document.getElementById('full-name').textContent = accountInfo.fullName;
  document.getElementById('followers-count').textContent = 
    `${accountInfo.followerCount.toLocaleString()} Seguidores`;
  
  // Update profile picture with proxied URL
  const profilePicture = document.getElementById('profile-picture');
  profilePicture.src = getProxiedImageUrl(accountInfo.profilePictureUrl);
  
  // Show connected state
  updateUIState('connected');
}

// ================ 4) Instagram API Integration ================
async function getInstagramCookies() {
  const neededCookies = ["csrftoken", "ds_user_id", "sessionid"];
  const foundCookies = {};
  
  try {
    for (const cookieName of neededCookies) {
      const cookie = await chrome.cookies.get({
        url: "https://www.instagram.com",
        name: cookieName,
      });
      if (cookie && cookie.value) {
        foundCookies[cookieName] = cookie.value;
      }
    }
    
    if (
      foundCookies["csrftoken"] &&
      foundCookies["ds_user_id"] &&
      foundCookies["sessionid"]
    ) {
      instagramCookies = foundCookies; // Store cookies globally
      return foundCookies;
    }
  } catch (error) {
    console.error('Error getting cookies:', error);
  }
  return null;
}

async function getInstagramAccountInfo() {
  try {
    const editResponse = await fetch(
      "https://www.instagram.com/api/v1/accounts/edit/web_form_data/",
      {
        credentials: "include",
        headers: {
          accept: "*/*",
          "x-requested-with": "XMLHttpRequest",
          "x-ig-app-id": "936619743392459",
        },
      }
    );

    if (!editResponse.ok) {
      throw new Error("Failed to get profile information (edit).");
    }

    const editData = await editResponse.json();
    const username = editData?.form_data?.username;

    if (!username) {
      throw new Error("Could not get Instagram username.");
    }

    const profileResponse = await fetch(
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`,
      {
        credentials: "include",
        headers: {
          accept: "*/*",
          "x-requested-with": "XMLHttpRequest",
          "x-ig-app-id": "936619743392459",
        },
      }
    );

    if (!profileResponse.ok) {
      throw new Error("Failed to get profile information (profile).");
    }

    const profileData = await profileResponse.json();
    const user = profileData?.data?.user;

    if (!user) {
      throw new Error("Invalid user profile.");
    }

    return {
      username: user.username,
      fullName: user.full_name,
      profilePictureUrl: user.profile_pic_url_hd || user.profile_pic_url,
      followerCount: user.edge_followed_by?.count || 0,
      userId: user.id
    };
  } catch (error) {
    console.error("Error fetching Instagram data:", error);
    return null;
  }
}

async function fetchFollowers(userId, after = null) {
  try {
    const variables = {
      id: userId,
      include_reel: true,
      fetch_mutual: true,
      first: 50,
      after: after
    };

    const response = await fetch(
      `https://www.instagram.com/graphql/query/?query_hash=c76146de99bb02f6415203be841dd25a&variables=${encodeURIComponent(
        JSON.stringify(variables)
      )}`
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching followers:', error);
    throw error;
  }
}

// ================ 5) Backend Integration ================
const API_BASE_URL = 'http://localhost:3000/api';

async function validateKey(key, cookies) {
  try {
    const response = await fetch(`${API_BASE_URL}/validatekey`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key, ...cookies }),
    });

    if (!response.ok) {
      throw new Error('Invalid key');
    }

    return await response.json();
  } catch (error) {
    console.error('Error validating key:', error);
    throw error;
  }
}

async function saveProgress(data) {
  try {
    const response = await fetch(`${API_BASE_URL}/saveprogress`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Failed to save progress');
    }

    return await response.json();
  } catch (error) {
    console.error('Error saving progress:', error);
    throw error;
  }
}

async function getProgress(key) {
  try {
    const response = await fetch(`${API_BASE_URL}/saveprogress?key=${key}`);
    if (!response.ok) {
      throw new Error('Failed to get progress');
    }
    return await response.json();
  } catch (error) {
    console.error('Error getting progress:', error);
    return null;
  }
}

// ================ 6) Main Process Logic ================
async function processFollowers(userId) {
  if (!isProcessing) return;

  try {
    const response = await fetchFollowers(userId, currentAfter);
    const edges = response.data.user.edge_followed_by.edges;
    const pageInfo = response.data.user.edge_followed_by.page_info;

    let shouldStartProcessing = !lastFollowerAdded; // If no last user, start from beginning
    
    for (const edge of edges) {
      // Skip users until we find the last processed one
      if (!shouldStartProcessing) {
        if (edge.node.username === lastFollowerAdded) {
          shouldStartProcessing = true; // Found last user, start processing from next one
          continue; // Skip the last processed user
        }
        continue;
      }

      if (!isProcessing) break;
      
      try {
        // Add to Close Friends
        await addToCloseFriends(edge.node.id);
        
        followersCollected++;
        lastFollowerAdded = edge.node.username;
        lastFollowerId = edge.node.id;
        updateProgressUI();
        
        // Increment counter
        countSaveProgress++;
        
        // Save progress every 244 followers or if it's the last one in the page
        if (countSaveProgress >= 244 || edge === edges[edges.length - 1]) {
          await saveProgress({
            key: currentKey,
            after: currentAfter,
            nextAfter: pageInfo.end_cursor,
            followersCollected,
            lastFollowerAdded,
            lastFollowerId,
            username: edge.node.username
          });
          countSaveProgress = 0; // Reset counter after saving
        }

        // Add a small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 9000));
      } catch (error) {
        console.error('Error adding follower to Close Friends:', error);
        showToast('Erro ao adicionar seguidor aos melhores amigos', 'error');
        isProcessing = false;
        updateButtonStates('paused');
        break;
      }
    }

    if (pageInfo.has_next_page && isProcessing) {
      currentAfter = pageInfo.end_cursor;
      // Reset lastFollowerAdded when moving to next page
      lastFollowerAdded = null;
      await processFollowers(userId);
    }
  } catch (error) {
    console.error('Error processing followers:', error);
    showToast('Erro ao processar seguidores', 'error');
    isProcessing = false;
    updateButtonStates('paused');
  }
}

// ================ 7) Event Listeners ================
validateKeyButton.addEventListener('click', async () => {
  const key = keyInput.value.trim();
  if (!key) {
    showToast('Por favor, insira uma chave válida', 'error');
    return;
  }

  validateKeyButton.disabled = true;
  try {
    const cookies = await getInstagramCookies();
    if (!cookies) {
      throw new Error('Cookies não encontrados');
    }

    await validateKey(key, cookies);
    currentKey = key;
    
    // Store the key in chrome.storage
    chrome.storage.local.set({ currentKey: key });
    
    const accountInfo = await getInstagramAccountInfo();
    if (accountInfo) {
      showConnectedState(accountInfo);
      
      // Check for existing progress
      const progress = await getProgress(key);
      if (progress) {
        currentAfter = progress.after;
        followersCollected = progress.followersCollected;
        lastFollowerAdded = progress.lastFollowerAdded;
        lastFollowerId = progress.lastFollowerId;
        updateProgressUI();
      }
      
      updateUIState('connected');
      updateButtonStates('initial');
    } else {
      throw new Error('Não foi possível obter informações da conta');
    }
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    validateKeyButton.disabled = false;
  }
});

startButton.addEventListener('click', async () => {
  try {
    // Get current progress before starting
    const progress = await getProgress(currentKey);
    if (progress) {
      currentAfter = progress.after;
      followersCollected = progress.followersCollected;
      lastFollowerAdded = progress.lastFollowerAdded;
      lastFollowerId = progress.lastFollowerId;
      updateProgressUI();
    } else {
      // Only reset if absolutely no progress exists
      currentAfter = null;
      followersCollected = 0;
      lastFollowerAdded = null;
      lastFollowerId = null;
      updateProgressUI();
    }

    isProcessing = true;
    updateButtonStates('running');
    
    const accountInfo = await getInstagramAccountInfo();
    if (accountInfo) {
      processFollowers(accountInfo.userId);
    }
  } catch (error) {
    console.error('Error starting process:', error);
    showToast('Erro ao iniciar o processo', 'error');
    updateButtonStates('initial');
  }
});

pauseButton.addEventListener('click', async () => {
  try {
    // Save current progress before pausing
    await saveProgress({
      key: currentKey,
      after: currentAfter,
      nextAfter: currentAfter, // Use current as next since we're pausing
      followersCollected,
      lastFollowerAdded,
      lastFollowerId,
      username: lastFollowerAdded
    });
    
    isProcessing = false;
    updateButtonStates('paused');
    showToast('Processo pausado');
  } catch (error) {
    console.error('Error saving progress on pause:', error);
    showToast('Erro ao salvar progresso', 'error');
  }
});

continueButton.addEventListener('click', async () => {
  try {
    // Get latest progress
    const progress = await getProgress(currentKey);
    if (progress) {
      currentAfter = progress.after;
      followersCollected = progress.followersCollected;
      lastFollowerAdded = progress.lastFollowerAdded;
      lastFollowerId = progress.lastFollowerId;
      updateProgressUI();
    }

    isProcessing = true;
    updateButtonStates('running');
    
    const accountInfo = await getInstagramAccountInfo();
    if (accountInfo) {
      processFollowers(accountInfo.userId);
    }
  } catch (error) {
    console.error('Error continuing process:', error);
    showToast('Erro ao continuar o processo', 'error');
    updateButtonStates('paused');
  }
});

stopButton.addEventListener('click', async () => {
  isProcessing = false;
  currentAfter = null;
  followersCollected = 0;
  lastFollowerAdded = null;
  lastFollowerId = null;
  updateProgressUI();
  updateButtonStates('initial');
  showToast('Processo finalizado');
});

// ================ 8) Initialization ================
async function initialize() {
  updateUIState('loading');
  
  try {
    const cookies = await getInstagramCookies();
    if (!cookies) {
      updateUIState('login');
      return;
    }

    const accountInfo = await getInstagramAccountInfo();
    if (!accountInfo) {
      updateUIState('login');
      return;
    }

    // Move to key input state first
    updateUIState('key-input');

    // If there's a stored key in chrome.storage, try to restore session
    chrome.storage.local.get(['currentKey'], async (result) => {
      if (result.currentKey) {
        try {
          // Validate the stored key
          await validateKey(result.currentKey, cookies);
          currentKey = result.currentKey;
          
          // Get and restore progress
          const progress = await getProgress(currentKey);
          if (progress) {
            currentAfter = progress.after;
            followersCollected = progress.followersCollected;
            lastFollowerAdded = progress.lastFollowerAdded;
            lastFollowerId = progress.lastFollowerId;
          }

          // Show connected state with progress
          showConnectedState(accountInfo);
          updateProgressUI();
          updateUIState('connected');
          updateButtonStates('initial');
        } catch (error) {
          console.error('Error restoring session:', error);
          // If restoration fails, stay in key input state
          updateUIState('key-input');
        }
      }
    });
  } catch (error) {
    console.error('Initialization error:', error);
    updateUIState('login');
    showToast('Erro ao carregar informações', 'error');
  }
}

// Add new function for Close Friends
async function addToCloseFriends(userId) {
  try {
    if (!instagramCookies || !instagramCookies.csrftoken) {
      // Try to get cookies again if they're not available
      const cookies = await getInstagramCookies();
      if (!cookies || !cookies.csrftoken) {
        throw new Error('CSRF token não encontrado');
      }
    }

    const response = await fetch('https://www.instagram.com/api/v1/friendships/set_besties/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-CSRFToken': instagramCookies.csrftoken,
        'X-IG-App-ID': '936619743392459',
        'X-ASBD-ID': '198387',
        'X-IG-WWW-Claim': 'hmac.AR0Oek4QO9GXwwGE2-nVGzKh3Kp1qvwNi_8wZHJt6z_NqPCY'
      },
      credentials: 'include', // Add this to include cookies in the request
      body: `remove=[]&add=["${userId}"]`
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Resposta da API com erro:', errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    //console.log('Resposta ao adicionar close friend:', data);
    return data;
  } catch (error) {
    console.error('Erro ao adicionar aos melhores amigos:', error);
    throw error;
  }
}

// Start the extension
document.addEventListener('DOMContentLoaded', initialize);