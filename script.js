let videoData = [];
let filteredVideos = [];
let currentIndex = 0;
const videosPerPage = 8;

function updateUrlAndSearch(query) {
    const baseUrl = window.location.origin + window.location.pathname;
    const urlParams = new URLSearchParams(window.location.search);

    if (query) {
        urlParams.set('q', query);
    } else {
        urlParams.delete('q');
    }

    const newUrl = baseUrl + (urlParams.toString() ? '?' + urlParams.toString() : '');
    
    window.history.pushState({ path: newUrl }, '', newUrl);

    executeSearchAndFilter(query);
}

function search() {
    const query = document.getElementById("search-input").value.trim();
    updateUrlAndSearch(query);
}

function executeSearchAndFilter(query) {
    if (query === "") {
        filteredVideos = [...videoData];
    } else {
        try {
            const regex = new RegExp(query, "i");
            filteredVideos = videoData.filter(video => regex.test(video.title));
        } catch (error) {
            console.error("无效的正则表达式:", error);
            alert("搜索关键字格式错误，请检查后重试！");
            filteredVideos = [...videoData];
        }
    }
    renderVideos(true);
}

document.addEventListener("DOMContentLoaded", function () {
    fetch("data.json")
        .then(response => response.json())
        .then(data => {
            videoData = data;
            
            const urlParams = new URLSearchParams(window.location.search);
            const initialQuery = urlParams.get('q');
            const searchInput = document.getElementById("search-input");

            if (initialQuery) {
                searchInput.value = initialQuery;
                executeSearchAndFilter(initialQuery);
            } else {
                filteredVideos = [...videoData];
                currentIndex = 0;
                renderVideos(true);
            }
        })
        .catch(error => console.error("加载 JSON 失败:", error));

    const searchInput = document.getElementById("search-input");
    searchInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            search();
        }
    });
});

function renderVideos(reset = false) {
    const container = document.getElementById("list");
    const loadMoreBtn = document.getElementById("load-more");

    if (reset) {
        container.innerHTML = "";
        currentIndex = 0;
        loadMoreBtn.style.display = "none";
    }

    if (filteredVideos.length === 0) {
        container.innerHTML = '<p style="color: #6c757d; font-size: 1.2rem; margin-top: 50px;">抱歉，没有找到匹配的结果。</p>';
        loadMoreBtn.style.display = "none";
        return; 
    }

    const videosToShow = filteredVideos.slice(currentIndex, currentIndex + videosPerPage);
    videosToShow.forEach(video => {
        const card = document.createElement("div");
        card.classList.add("video-card");
        
        card.addEventListener("click", function () {
            window.open(video.link, "_blank");
        });

        card.innerHTML = `
            <img src="${video.thumbnail}" alt="${video.title}">
            <h3>${video.title}</h3>
            <p>类型: ${video.type}</p>
        `;

        container.appendChild(card);
    });

    currentIndex += videosToShow.length;
    if (currentIndex < filteredVideos.length) {
        loadMoreBtn.style.display = "block";
    } else {
        loadMoreBtn.style.display = "none";
    }
}

function loadMoreVideos() {
    renderVideos(false);

}
