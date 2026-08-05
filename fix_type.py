with open('backend/src/handlers.rs', 'r') as f:
    content = f.read()

content = content.replace(
    'let (tx, rx) = tokio::sync::mpsc::channel::<Result<actix_web::web::Bytes, std::io::Error>>(16);',
    'let (tx, rx) = tokio::sync::mpsc::channel::<Result<actix_web::web::Bytes, actix_web::Error>>(16);'
)

with open('backend/src/handlers.rs', 'w') as f:
    f.write(content)
