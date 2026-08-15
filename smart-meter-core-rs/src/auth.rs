use crate::config::JwtConfig;
use crate::models::{Claims, LoginRequest, LoginResponse, UserInfo};
use anyhow::Result;
use chrono::Utc;
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};

pub struct AuthService {
    config: JwtConfig,
}

impl AuthService {
    pub fn new(config: JwtConfig) -> Self {
        Self { config }
    }

    pub fn login(&self, req: LoginRequest) -> Result<LoginResponse> {
        let role = req.role.unwrap_or_else(|| "CONSUMER".to_string()).to_uppercase();
        if !["CONSUMER", "UTILITY", "ADMIN"].contains(&role.as_str()) {
            anyhow::bail!("Invalid role");
        }

        let user_id = format!("usr_{}", abs_hash(&req.email) % 1_000_000);
        let name = req.email.split('@').next().unwrap_or(&req.email).to_string();

        let user = UserInfo {
            id: user_id.clone(),
            email: req.email.clone(),
            name,
            role: role.clone(),
            meter_id: if role == "CONSUMER" {
                req.meter_id.or_else(|| Some("MTR-8829-X1".to_string()))
            } else {
                None
            },
        };

        let exp = Utc::now() + chrono::Duration::days(1);
        
        let claims = Claims {
            sub: user_id,
            role,
            meter_id: user.meter_id.clone(),
            exp: exp.timestamp(),
        };

        let header = Header::new(Algorithm::HS256);
        let token = encode(
            &header,
            &claims,
            &EncodingKey::from_secret(self.config.secret.as_bytes()),
        ).map_err(|e| anyhow::anyhow!("JWT error: {}", e))?;

        Ok(LoginResponse {
            token,
            user,
            expires_in: 86400,
        })
    }

    pub fn validate_token(&self, token: &str) -> Option<Claims> {
        let validation = Validation::new(Algorithm::HS256);
        
        decode::<Claims>(
            token,
            &DecodingKey::from_secret(self.config.secret.as_bytes()),
            &validation,
        )
        .ok()
        .map(|data| data.claims)
    }
}

fn abs_hash(s: &str) -> usize {
    s.bytes().fold(0usize, |acc, b| acc.wrapping_add(b as usize))
}