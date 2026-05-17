document.getElementById("inspectBtn").addEventListener("click", async () => {

    const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
    });

    await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["lib/jszip.min.js"]
    });

    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: inspectClients
    });

});


async function inspectClients() {
    const descriptionEl = document.querySelector(".description");

    const originalDescription = descriptionEl.innerHTML;

    const API_BASE =
        "https://b90c-14-187-77-107.ngrok-free.app";

    const wait = (ms) =>
        new Promise(resolve => setTimeout(resolve, ms));

    function sanitize(text) {

        return text
            .replace(/[<>:"/\\|?*]+/g, "_")
            .replace(/\s+/g, " ")
            .trim();

    }
    

    async function buildZip(pageName) {

        const zip = new JSZip();

        let html = document.documentElement.outerHTML;

        const assetsFolder = zip.folder("assets");

        // CSS
        const cssLinks = [...document.querySelectorAll('link[rel="stylesheet"]')];

        for (let i = 0; i < cssLinks.length; i++) {

            try {
                const href = cssLinks[i].href;
                if (!href) continue;
                const response = await fetch(href);
                const css = await response.text();
                const fileName = `style_${i}.css`;
                assetsFolder.file(fileName, css);
                html = html.replace(href, `assets/${fileName}`);
            } catch (error) {
                console.error(
                    "CSS download failed:",
                    error
                );
            }

        }

        // IMAGES
        const images = [
            ...document.images
        ];

        for (let i = 0; i < images.length; i++) {
            try {
                const src = images[i].src;
                if (!src) continue;
                const response = await fetch(src);
                const blob = await response.blob();
                const ext = blob.type.split("/")[1] || "png";
                const fileName = `image_${i}.${ext}`;
                assetsFolder.file(fileName, blob);
                html = html.replace(src, `assets/${fileName}`);
            } catch (error) {
                console.error("Image download failed:", error);
            }
        }
        zip.file("index.html", html);
        return await zip.generateAsync({ type: "blob" });
    }

    async function uploadPage({ title, pageType }) {
        try {
            setProgress(`Uploading ${pageType}...`);
            const zipBlob = await buildZip(title);
            const formData = new FormData();
            formData.append("url", window.location.href);
            formData.append("title", title);
            formData.append("page_type", pageType);
            formData.append("file", zipBlob, `${pageType}_${title}.zip`);
            const response = await fetch(`${API_BASE}/save`, { method: "POST", body: formData });
            const result = await response.json();
            setProgress("Upload success:", result);
        } catch (error) {
            console.error("Upload failed:", error);
        }
    }

    async function openTask(taskElement) {
        const clickableArea =
            taskElement.querySelector(
                ".description-wrapper"
            ) || taskElement;

        clickableArea.click();

        await wait(5000);

    }

    async function clickActivityTab() {
        setProgress("Searching activity tab...");
        const commentIcon = document.querySelector("app-icon.icon-comment");
        if (!commentIcon) {
            setProgress("Comment icon not found");
            return false;
        }
        const iconContainer = commentIcon.closest(".icon-container");

        if (!iconContainer) {
            setProgress("Icon container not found");
            return false;

        }

        iconContainer.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });

        await wait(1000);

        [
            "mousedown",
            "mouseup",
            "click"
        ].forEach(eventType => {

            iconContainer.dispatchEvent(
                new MouseEvent(eventType, {
                    bubbles: true,
                    cancelable: true,
                    view: window
                })
            );

        });

        await wait(4000);

        setProgress(
            "Activity tab clicked"
        );

        return true;

    }

    async function closeTaskSidebar() {
        const closeButton = document.querySelector('div.action.cursor-pointer[title="Close"]');
        if (!closeButton) {
            setProgress("Close button not found");
            return false;
        }
        closeButton.scrollIntoView({ behavior: "smooth", block: "center" });
        await wait(1000);
        [
            "mousedown",
            "mouseup",
            "click"
        ].forEach(eventType => {

            closeButton.dispatchEvent(
                new MouseEvent(eventType, {
                    bubbles: true,
                    cancelable: true,
                    view: window
                })
            );

        });

        await wait(3000);
        setProgress("Sidebar closed");
        return true;

    }

    function getClients() {
        const itemsDivs = document.querySelectorAll("div.items");
        const targetDiv = itemsDivs[1];
        if (!targetDiv) {
            setProgress("Second items div not found");
            return [];
        }

        return [
            ...targetDiv.querySelectorAll(
                "app-filter-list-item"
            )
        ];

    }

    function getTasks() {
        return [...document.querySelectorAll("tr.task")];
    }

    const clients = getClients();

    setProgress("CLIENTS FOUND:", clients.length);

    for (let i = 0; i < clients.length; i++) {
        try {
            const client = clients[i];

            const titleElement = client.querySelector(".text");

            if (!titleElement) continue;

            const clientName = titleElement.innerText.trim();

            if (!clientName || clientName === "All Clients") {
                continue;
            }

            setProgress("CLIENT:", clientName);
            client.click();
            await wait(5000);
            const tasks = getTasks();
            setProgress(`TASKS FOUND: ${tasks.length}`);
            for (let j = 0; j < tasks.length; j++) {
                try {
                    const task = tasks[j];
                    const taskTitle = task.querySelector(".title.text-ellipsis");
                    if (!taskTitle) continue;
                    const taskName = sanitize(taskTitle.innerText.trim());
                    if (!taskName) continue;
                    setProgress(`TASK ${j + 1}:`, taskName);
                    // OPEN TASK
                    await openTask(task);
                    // SAVE TASK DETAIL
                    await uploadPage({ title: taskName, pageType: "task_detail" });
                    // OPEN ACTIVITY TAB
                    const opened = await clickActivityTab();
                    if (opened) {
                        // SAVE ACTIVITY PAGE
                        await uploadPage({ title: taskName, pageType: "activity" });
                    }
                    // CLOSE SIDEBAR
                    await closeTaskSidebar();

                } catch (taskError) {
                    console.error("TASK FAILED:", taskError);
                }
                await wait(3000);
            }
        } catch (clientError) {
            console.error("CLIENT FAILED:", clientError);
        }
        await wait(3000);
    }
    setProgress("DONE");
}