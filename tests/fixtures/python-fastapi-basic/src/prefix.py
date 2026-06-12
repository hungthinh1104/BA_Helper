from fastapi import APIRouter

prefixed_router = APIRouter(prefix="/api")

# 4. APIRouter prefix unsupported
@prefixed_router.post("/unsupported_prefix")
def unsupported_prefix_route():
    pass
