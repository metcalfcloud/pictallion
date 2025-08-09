use super::*;
use tokio;

#[tokio::test]
async fn test_get_photo_metadata_invalid_path() {
    let result = get_photo_metadata("nonexistent.jpg".to_string()).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_set_photo_metadata_invalid_json() {
    let result = set_photo_metadata("nonexistent.jpg".to_string(), "not_json".to_string()).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_list_people_stub() {
    let result = list_people().await;
    assert!(result.is_ok());
    assert_eq!(result.unwrap().len(), 0);
}

#[tokio::test]
async fn test_create_person_stub() {
    let req = CreatePersonRequest {
        name: "Test".to_string(),
        birthdate: None,
        notes: None,
        is_public: true,
        selected_thumbnail_face_id: None,
    };
    let result = create_person(req).await;
    assert!(result.is_ok());
    assert_eq!(result.unwrap().name, "Test");
}

#[tokio::test]
async fn test_list_photos_stub() {
    let result = list_photos().await;
    assert!(result.is_ok());
    // Accept empty or stubbed result
}

#[tokio::test]
async fn test_face_detection_health_check() {
    let result = face_detection_health_check().await;
    assert!(result.is_ok());
}

#[tokio::test]
async fn test_get_analytics_stub() {
    let result = get_analytics().await;
    assert!(result.is_ok());
    let analytics = result.unwrap();
    assert!(!analytics.upload_trends.is_empty());
}