import urllib.request
import json
import sys

sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = "http://localhost:8000"

def run_tests():
    print("=== RUNNING FULL CRUD LIFECYCLE TESTS ===")

    # 1. Healthcheck
    res = urllib.request.urlopen(f"{BASE_URL}/api/health")
    health = json.loads(res.read())
    print("[1] Healthcheck:", health["status"], "| Database:", health["database"]["db_type"])
    assert health["status"] == "online"

    # 2. CREATE
    payload = {
        "title": "Hinglish Client Pitch",
        "content": "Main kal morning office pahuch ke slides review karunga with the design team.",
        "tags": ["pitch", "hinglish", "team"],
        "is_favorite": True
    }
    req = urllib.request.Request(
        f"{BASE_URL}/api/transcriptions",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    res = json.loads(urllib.request.urlopen(req).read())
    created_id = res["id"]
    print(f"[2] CREATE Success - ID: {created_id}, Language: {res['language']}, Primary: {res['primary_language']}")
    assert "Hinglish" in res["language"] or "Multilingual" in res["language"]

    # 3. READ SINGLE
    res = urllib.request.urlopen(f"{BASE_URL}/api/transcriptions/{created_id}")
    item = json.loads(res.read())
    print(f"[3] READ Single - Title: '{item['title']}', Words: {item['word_count']}")
    assert item["id"] == created_id

    # 4. UPDATE
    update_payload = {
        "title": "Updated Hinglish Client Pitch (Reviewed)",
        "notes": "Verified Hindi and English words"
    }
    req = urllib.request.Request(
        f"{BASE_URL}/api/transcriptions/{created_id}",
        data=json.dumps(update_payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="PUT"
    )
    res = json.loads(urllib.request.urlopen(req).read())
    print(f"[4] UPDATE Success - New Title: '{res['title']}', Notes: '{res['notes']}'")
    assert res["title"] == update_payload["title"]

    # 5. LIST with Search & Filter
    res = urllib.request.urlopen(f"{BASE_URL}/api/transcriptions?q=pitch")
    search_data = json.loads(res.read())
    print(f"[5] LIST Search - Found {len(search_data['items'])} matching items")
    assert any(x["id"] == created_id for x in search_data["items"])

    # 6. Open-Source TTS Generation
    tts_payload = {"text": "Aapka project successfully deploy ho gaya hai.", "lang": "hi"}
    req = urllib.request.Request(
        f"{BASE_URL}/api/tts/generate",
        data=json.dumps(tts_payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    tts_res = json.loads(urllib.request.urlopen(req).read())
    print(f"[6] TTS Generation Success - URL: {tts_res['audio_url']}")
    assert "audio_url" in tts_res

    # 7. DELETE
    req = urllib.request.Request(f"{BASE_URL}/api/transcriptions/{created_id}", method="DELETE")
    del_res = json.loads(urllib.request.urlopen(req).read())
    print(f"[7] DELETE Success - Status: {del_res['status']}")
    assert del_res["status"] == "success"

    # 8. Stats
    res = urllib.request.urlopen(f"{BASE_URL}/api/dashboard/stats")
    stats = json.loads(res.read())
    print(f"[8] Dashboard Stats: {stats['total_transcriptions']} records, {stats['total_words']} total words")

    print("\nALL 8/8 INTEGRATION TESTS PASSED PERFECTLY!")

if __name__ == "__main__":
    run_tests()
